"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PriorityFlag } from "@/components/ui/PriorityFlag";
import {
  LEAD_SCORE_HIGH_PRIORITY,
  LEAD_SCORE_MEDIUM_PRIORITY,
  LEAD_SCORE_LOW_PRIORITY,
  LEAD_SCORE_MIN,
  LEAD_SCORE_MAX,
  getLeadPriorityLabel,
  getLeadPriorityColor,
} from "@/lib/constants";
import type { LeadScoreResult } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  intentScore: number;
  engagementScore: number;
  budgetScore: number;
  locationScore: number;
  urgencyScore: number;
  completenessScore: number;
  total: number;
  reasons: string[];
}

export interface LeadScoreDisplayProps {
  /** Lead score between 0 and 10 */
  score: number;
  /** Whether the lead is explicitly flagged as high priority */
  priorityFlag?: boolean;
  /** Score reasoning text (from LeadScoreResult) */
  reasoning?: string | null;
  /** Detailed score breakdown (from getScoreBreakdown) */
  breakdown?: ScoreBreakdown | null;
  /** Lead score result object (alternative to individual props) */
  scoreResult?: LeadScoreResult | null;
  /** Whether to show the breakdown tooltip on hover */
  showBreakdownTooltip?: boolean;
  /** Whether to show the reasoning text inline */
  showReasoning?: boolean;
  /** Whether to show the score bar visualization */
  showBar?: boolean;
  /** Whether to show the priority flag component */
  showPriorityFlag?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Size Configuration ──────────────────────────────────────────────────────

const SIZE_CONFIG: Record<string, {
  scoreText: string;
  labelText: string;
  reasoningText: string;
  barHeight: string;
  tooltipOffset: string;
  gap: string;
  padding: string;
}> = {
  sm: {
    scoreText: "text-lg",
    labelText: "text-xs",
    reasoningText: "text-xs",
    barHeight: "h-1.5",
    tooltipOffset: "bottom-8",
    gap: "gap-2",
    padding: "p-2.5",
  },
  md: {
    scoreText: "text-2xl",
    labelText: "text-sm",
    reasoningText: "text-xs",
    barHeight: "h-2",
    tooltipOffset: "bottom-10",
    gap: "gap-3",
    padding: "p-3",
  },
  lg: {
    scoreText: "text-3xl",
    labelText: "text-base",
    reasoningText: "text-sm",
    barHeight: "h-3",
    tooltipOffset: "bottom-12",
    gap: "gap-4",
    padding: "p-4",
  },
};

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getScoreBarColor(score: number): string {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "bg-red-500";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "bg-orange-400";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "bg-yellow-400";
  return "bg-gray-300";
}

function getScoreBarTrackColor(score: number): string {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "bg-red-100";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "bg-orange-100";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "bg-yellow-100";
  return "bg-gray-100";
}

function getScoreTextColor(score: number): string {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "text-red-600";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "text-orange-600";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "text-yellow-600";
  return "text-gray-500";
}

function getScoreBorderColor(score: number): string {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "border-red-200";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "border-orange-200";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "border-yellow-200";
  return "border-gray-200";
}

function getScoreBgColor(score: number): string {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "bg-red-50";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "bg-orange-50";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "bg-yellow-50";
  return "bg-gray-50";
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function InfoIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function TargetIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function DollarIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function MapPinIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function MessageSquareIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Breakdown Dimension Config ──────────────────────────────────────────────

interface BreakdownDimension {
  key: keyof Omit<ScoreBreakdown, "total" | "reasons">;
  label: string;
  maxScore: number;
  icon: (props: { className: string }) => React.ReactNode;
  color: string;
  barColor: string;
}

const BREAKDOWN_DIMENSIONS: BreakdownDimension[] = [
  {
    key: "intentScore",
    label: "Intent",
    maxScore: 3.0,
    icon: TargetIcon,
    color: "text-purple-600",
    barColor: "bg-purple-500",
  },
  {
    key: "engagementScore",
    label: "Engagement",
    maxScore: 2.0,
    icon: MessageSquareIcon,
    color: "text-blue-600",
    barColor: "bg-blue-500",
  },
  {
    key: "budgetScore",
    label: "Budget",
    maxScore: 2.0,
    icon: DollarIcon,
    color: "text-green-600",
    barColor: "bg-green-500",
  },
  {
    key: "locationScore",
    label: "Location",
    maxScore: 1.5,
    icon: MapPinIcon,
    color: "text-orange-600",
    barColor: "bg-orange-500",
  },
  {
    key: "urgencyScore",
    label: "Urgency",
    maxScore: 1.0,
    icon: ClockIcon,
    color: "text-red-600",
    barColor: "bg-red-500",
  },
  {
    key: "completenessScore",
    label: "Completeness",
    maxScore: 0.5,
    icon: CheckCircleIcon,
    color: "text-teal-600",
    barColor: "bg-teal-500",
  },
];

// ─── Sub-Components ──────────────────────────────────────────────────────────

function BreakdownBar({
  dimension,
  value,
}: {
  dimension: BreakdownDimension;
  value: number;
}) {
  const percentage = dimension.maxScore > 0
    ? Math.min(100, Math.round((value / dimension.maxScore) * 100))
    : 0;

  const IconComponent = dimension.icon;

  return (
    <div className="flex items-center gap-2">
      <span className={`flex-shrink-0 ${dimension.color}`}>
        <IconComponent className="h-3 w-3" />
      </span>
      <span className="w-20 flex-shrink-0 text-xs text-gray-600">
        {dimension.label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${dimension.barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-12 flex-shrink-0 text-right text-xs font-medium text-gray-500">
        {value}/{dimension.maxScore}
      </span>
    </div>
  );
}

function BreakdownTooltipContent({
  breakdown,
}: {
  breakdown: ScoreBreakdown;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          Score Breakdown
        </span>
        <span className="text-xs font-bold text-gray-800">
          {breakdown.total}/{LEAD_SCORE_MAX}
        </span>
      </div>

      {/* Dimension Bars */}
      <div className="space-y-1.5">
        {BREAKDOWN_DIMENSIONS.map((dimension) => (
          <BreakdownBar
            key={dimension.key}
            dimension={dimension}
            value={breakdown[dimension.key]}
          />
        ))}
      </div>

      {/* Reasons */}
      {breakdown.reasons.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <span className="text-xs font-semibold text-gray-600">
            Scoring Factors
          </span>
          <ul className="mt-1 space-y-0.5">
            {breakdown.reasons.map((reason, index) => (
              <li
                key={index}
                className="flex items-start gap-1 text-xs text-gray-500"
              >
                <span className="mt-0.5 flex-shrink-0 text-green-500">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explainability Note */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Score is based on behavioural and declared signals only — no
          demographic data is used. Dimensions: Intent (max 3), Engagement (max
          2), Budget (max 2), Location (max 1.5), Urgency (max 1),
          Completeness (max 0.5).
        </p>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Lead score visualization component.
 *
 * Displays a numeric lead score (0–10) with color-coded styling,
 * a priority flag for high-priority leads (≥8.0), an optional
 * score bar visualization, and a breakdown tooltip explaining
 * the rule-based scoring factors.
 *
 * Scoring is transparent and explainable:
 * - Intent signals (max 3.0): purchase intent, pre-approval, property type
 * - Engagement signals (max 2.0): visit requests, questions, message detail
 * - Budget signals (max 2.0): budget specified, range, pre-approval backing
 * - Location signals (max 1.5): specific location, high-demand community
 * - Urgency signals (max 1.0): timeline, current housing situation
 * - Completeness (max 0.5): number of extracted lead fields
 *
 * Uses ONLY behavioural and declared signals — no demographic data
 * is used (bias mitigation).
 *
 * Accessible with ARIA attributes for screen readers.
 *
 * Usage:
 * ```tsx
 * <LeadScoreDisplay score={8.5} priorityFlag />
 * <LeadScoreDisplay
 *   score={7.2}
 *   reasoning="Score: 7.2/10 (medium priority). Budget specified; Specific location interest."
 *   showReasoning
 *   showBar
 * />
 * <LeadScoreDisplay
 *   scoreResult={scoreResult}
 *   breakdown={scoreBreakdown}
 *   showBreakdownTooltip
 *   showBar
 *   showPriorityFlag
 *   size="lg"
 * />
 * ```
 */
export function LeadScoreDisplay({
  score,
  priorityFlag = false,
  reasoning = null,
  breakdown = null,
  scoreResult = null,
  showBreakdownTooltip = true,
  showReasoning = false,
  showBar = true,
  showPriorityFlag = true,
  size = "md",
  className = "",
}: LeadScoreDisplayProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve props from scoreResult if provided
  const resolvedScore = scoreResult?.score ?? score;
  const resolvedPriorityFlag = scoreResult?.priorityFlag ?? priorityFlag;
  const resolvedReasoning = scoreResult?.reasoning ?? reasoning;

  // Clamp score to valid range
  const clampedScore = Math.max(LEAD_SCORE_MIN, Math.min(LEAD_SCORE_MAX, resolvedScore));
  const roundedScore = Math.round(clampedScore * 10) / 10;
  const scorePercentage = Math.round((clampedScore / LEAD_SCORE_MAX) * 100);

  const isHighPriority = resolvedPriorityFlag || clampedScore >= LEAD_SCORE_HIGH_PRIORITY;

  const sizeConfig = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const scoreTextColor = getScoreTextColor(clampedScore);
  const barColor = getScoreBarColor(clampedScore);
  const barTrackColor = getScoreBarTrackColor(clampedScore);
  const borderColor = getScoreBorderColor(clampedScore);
  const bgColor = getScoreBgColor(clampedScore);
  const priorityLabel = getLeadPriorityLabel(clampedScore);

  const ariaLabel = `Lead score: ${roundedScore} out of ${LEAD_SCORE_MAX}. Priority: ${priorityLabel}${isHighPriority ? " (flagged)" : ""}.`;

  const hasBreakdown = breakdown !== null && showBreakdownTooltip;

  const handleMouseEnter = useCallback(() => {
    if (hasBreakdown) {
      setIsTooltipVisible(true);
    }
  }, [hasBreakdown]);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (hasBreakdown) {
      setIsTooltipVisible(true);
    }
  }, [hasBreakdown]);

  const handleBlur = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  // Close tooltip on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isTooltipVisible) {
        setIsTooltipVisible(false);
      }
    }

    if (isTooltipVisible) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isTooltipVisible]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg border ${borderColor} ${bgColor} ${sizeConfig.padding} ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={hasBreakdown ? 0 : undefined}
      aria-describedby={hasBreakdown ? "lead-score-breakdown-tooltip" : undefined}
    >
      {/* Score Header Row */}
      <div className={`flex items-center justify-between ${sizeConfig.gap}`}>
        {/* Score Value */}
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1">
            <span
              className={`${sizeConfig.scoreText} font-bold ${scoreTextColor}`}
              aria-hidden="true"
            >
              {roundedScore}
            </span>
            <span className="text-xs font-medium text-gray-400">
              /{LEAD_SCORE_MAX}
            </span>
          </div>

          {/* Priority Label */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 ${sizeConfig.labelText} font-medium ${
              isHighPriority
                ? "bg-red-100 text-red-700"
                : clampedScore >= LEAD_SCORE_MEDIUM_PRIORITY
                  ? "bg-orange-100 text-orange-700"
                  : clampedScore >= LEAD_SCORE_LOW_PRIORITY
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
            }`}
            aria-hidden="true"
          >
            {priorityLabel} Priority
          </span>
        </div>

        {/* Priority Flag + Info Icon */}
        <div className="flex items-center gap-2">
          {showPriorityFlag && (
            <PriorityFlag
              score={clampedScore}
              priorityFlag={resolvedPriorityFlag}
              showScore={false}
              showLabel={false}
              size={size}
            />
          )}

          {hasBreakdown && (
            <button
              type="button"
              onClick={() => setIsTooltipVisible((prev) => !prev)}
              className="flex-shrink-0 rounded-md p-0.5 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
              aria-label="Show score breakdown"
              aria-expanded={isTooltipVisible}
            >
              <InfoIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Score Bar */}
      {showBar && (
        <div className="mt-2">
          <div
            className={`w-full ${barTrackColor} ${sizeConfig.barHeight} rounded-full overflow-hidden`}
            role="meter"
            aria-valuenow={roundedScore}
            aria-valuemin={LEAD_SCORE_MIN}
            aria-valuemax={LEAD_SCORE_MAX}
            aria-label={`Lead score: ${roundedScore} out of ${LEAD_SCORE_MAX}`}
          >
            <div
              className={`${barColor} ${sizeConfig.barHeight} rounded-full transition-all duration-300 ease-out`}
              style={{ width: `${scorePercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Reasoning Text */}
      {showReasoning && resolvedReasoning && (
        <div className="mt-2">
          <p className={`${sizeConfig.reasoningText} leading-relaxed text-gray-500`}>
            {resolvedReasoning}
          </p>
        </div>
      )}

      {/* High Priority Alert */}
      {isHighPriority && (
        <div className="mt-2 flex items-center gap-1.5">
          <TrendingUpIcon className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-600">
            High-priority lead — recommend immediate follow-up
          </span>
        </div>
      )}

      {/* Breakdown Tooltip */}
      {hasBreakdown && isTooltipVisible && breakdown && (
        <div
          ref={tooltipRef}
          id="lead-score-breakdown-tooltip"
          role="tooltip"
          className={`absolute ${sizeConfig.tooltipOffset} left-0 z-50 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg`}
        >
          <BreakdownTooltipContent breakdown={breakdown} />
        </div>
      )}
    </div>
  );
}

export default LeadScoreDisplay;