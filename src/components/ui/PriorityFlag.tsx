"use client";

import {
  LEAD_SCORE_HIGH_PRIORITY,
  LEAD_SCORE_MEDIUM_PRIORITY,
  LEAD_SCORE_LOW_PRIORITY,
  LEAD_SCORE_MIN,
  LEAD_SCORE_MAX,
  getLeadPriorityLabel,
  getLeadPriorityColor,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriorityFlagProps {
  /** Lead score between 0 and 10 */
  score: number;
  /** Whether the lead is explicitly flagged as high priority */
  priorityFlag?: boolean;
  /** Whether to show the numeric score alongside the flag */
  showScore?: boolean;
  /** Whether to show the priority label text */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Size Configuration ──────────────────────────────────────────────────────

const SIZE_CONFIG: Record<string, { icon: string; text: string; gap: string; padding: string }> = {
  sm: {
    icon: "h-3.5 w-3.5",
    text: "text-xs",
    gap: "gap-1",
    padding: "px-1.5 py-0.5",
  },
  md: {
    icon: "h-4 w-4",
    text: "text-sm",
    gap: "gap-1.5",
    padding: "px-2 py-0.5",
  },
  lg: {
    icon: "h-5 w-5",
    text: "text-base",
    gap: "gap-2",
    padding: "px-2.5 py-1",
  },
};

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getFlagIconColor(score: number, priorityFlag: boolean): string {
  if (priorityFlag || score >= LEAD_SCORE_HIGH_PRIORITY) return "text-red-500";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "text-orange-500";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "text-yellow-500";
  return "text-gray-400";
}

function getFlagBgColor(score: number, priorityFlag: boolean): string {
  if (priorityFlag || score >= LEAD_SCORE_HIGH_PRIORITY) return "bg-red-50";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "bg-orange-50";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "bg-yellow-50";
  return "bg-gray-50";
}

function getFlagBorderColor(score: number, priorityFlag: boolean): string {
  if (priorityFlag || score >= LEAD_SCORE_HIGH_PRIORITY) return "border-red-200";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "border-orange-200";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "border-yellow-200";
  return "border-gray-200";
}

function getScoreTextColor(score: number, priorityFlag: boolean): string {
  if (priorityFlag || score >= LEAD_SCORE_HIGH_PRIORITY) return "text-red-700";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "text-orange-700";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "text-yellow-700";
  return "text-gray-500";
}

// ─── Flag Icon SVG ───────────────────────────────────────────────────────────

function FlagIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054a8.25 8.25 0 0 0 5.58.652l.096-.019a.75.75 0 0 1 .903.734v9.131a.75.75 0 0 1-.53.717 9.75 9.75 0 0 1-6.975-.533l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-1.947.487V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Lead priority flag indicator component.
 *
 * Displays a flag icon with optional score and label, color-coded
 * based on the lead score thresholds defined in constants.
 *
 * Color coding:
 * - Red: High priority (score ≥ 8.0 or priorityFlag is true)
 * - Orange: Medium priority (score ≥ 5.0)
 * - Yellow: Low priority (score ≥ 3.0)
 * - Gray: Very low priority (score < 3.0)
 *
 * Accessible with ARIA attributes for screen readers.
 *
 * Usage:
 * ```tsx
 * <PriorityFlag score={8.5} priorityFlag />
 * <PriorityFlag score={6.2} showScore showLabel />
 * <PriorityFlag score={2.1} size="lg" />
 * ```
 */
export function PriorityFlag({
  score,
  priorityFlag = false,
  showScore = true,
  showLabel = false,
  size = "md",
  className = "",
}: PriorityFlagProps) {
  // Clamp score to valid range
  const clampedScore = Math.max(LEAD_SCORE_MIN, Math.min(LEAD_SCORE_MAX, score));
  const roundedScore = Math.round(clampedScore * 10) / 10;

  const isHighPriority = priorityFlag || clampedScore >= LEAD_SCORE_HIGH_PRIORITY;

  const sizeConfig = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const iconColor = getFlagIconColor(clampedScore, priorityFlag);
  const bgColor = getFlagBgColor(clampedScore, priorityFlag);
  const borderColor = getFlagBorderColor(clampedScore, priorityFlag);
  const scoreColor = getScoreTextColor(clampedScore, priorityFlag);
  const priorityLabel = getLeadPriorityLabel(clampedScore);

  const ariaLabel = `Lead priority: ${priorityLabel}${isHighPriority ? " (flagged)" : ""}. Score: ${roundedScore} out of ${LEAD_SCORE_MAX}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-full border font-medium ${sizeConfig.gap} ${sizeConfig.padding} ${bgColor} ${borderColor} ${className}`.trim()}
    >
      <FlagIcon className={`${sizeConfig.icon} ${iconColor} flex-shrink-0`} />

      {showScore && (
        <span
          className={`${sizeConfig.text} font-semibold ${scoreColor}`}
          aria-hidden="true"
        >
          {roundedScore}
        </span>
      )}

      {showLabel && (
        <span
          className={`${sizeConfig.text} font-medium ${scoreColor}`}
          aria-hidden="true"
        >
          {priorityLabel}
        </span>
      )}

      {/* Screen reader only text when visual indicators are hidden */}
      {!showScore && !showLabel && (
        <span className="sr-only">
          {priorityLabel} priority, score {roundedScore}
        </span>
      )}
    </span>
  );
}

export default PriorityFlag;