"use client";

import {
  CONFIDENCE_THRESHOLD_LOW,
  CONFIDENCE_THRESHOLD_MEDIUM,
  CONFIDENCE_THRESHOLD_HIGH,
  getConfidenceLabel,
} from "@/lib/constants";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfidenceMeterProps {
  /** Confidence score between 0 and 1 */
  score: number;
  /** Whether to show the percentage label inline */
  showLabel?: boolean;
  /** Whether to show the tooltip on hover */
  showTooltip?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Size Configuration ──────────────────────────────────────────────────────

const SIZE_CONFIG: Record<string, { bar: string; text: string; height: string; tooltipOffset: string }> = {
  sm: {
    bar: "h-1.5 rounded-full",
    text: "text-xs",
    height: "h-1.5",
    tooltipOffset: "bottom-6",
  },
  md: {
    bar: "h-2 rounded-full",
    text: "text-sm",
    height: "h-2",
    tooltipOffset: "bottom-8",
  },
  lg: {
    bar: "h-3 rounded-full",
    text: "text-base",
    height: "h-3",
    tooltipOffset: "bottom-10",
  },
};

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getBarColor(score: number): string {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return "bg-green-500";
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return "bg-green-400";
  if (score >= CONFIDENCE_THRESHOLD_LOW) return "bg-yellow-400";
  return "bg-red-500";
}

function getTextColor(score: number): string {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return "text-green-600";
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return "text-green-500";
  if (score >= CONFIDENCE_THRESHOLD_LOW) return "text-yellow-600";
  return "text-red-600";
}

function getBgTrackColor(score: number): string {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return "bg-green-100";
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return "bg-green-50";
  if (score >= CONFIDENCE_THRESHOLD_LOW) return "bg-yellow-100";
  return "bg-red-100";
}

function getTooltipDescription(score: number): string {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) {
    return "High confidence — the AI draft closely matches knowledge base context and addresses the customer's specific needs. Ready for review.";
  }
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) {
    return "Medium confidence — the AI draft has good context alignment but may benefit from agent review and minor edits before sending.";
  }
  if (score >= CONFIDENCE_THRESHOLD_LOW) {
    return "Low confidence — limited knowledge base context was available. Agent review and editing is recommended before approval.";
  }
  return "Very low confidence — minimal context match. The draft should be carefully reviewed and edited by an agent before approval.";
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AI confidence score visualization component.
 *
 * Displays a confidence score (0–1) as a percentage with a color-coded
 * progress bar and optional tooltip explaining the confidence calculation.
 *
 * Color gradient:
 * - Red: < 70% (below CONFIDENCE_THRESHOLD_LOW)
 * - Yellow: 70–85% (between LOW and MEDIUM thresholds)
 * - Green: > 85% (above CONFIDENCE_THRESHOLD_MEDIUM)
 * - Bright green: > 95% (above CONFIDENCE_THRESHOLD_HIGH)
 *
 * Accessible with ARIA attributes for screen readers.
 *
 * Usage:
 * ```tsx
 * <ConfidenceMeter score={0.92} />
 * <ConfidenceMeter score={0.75} size="lg" showTooltip />
 * <ConfidenceMeter score={0.55} showLabel={false} />
 * ```
 */
export function ConfidenceMeter({
  score,
  showLabel = true,
  showTooltip = true,
  size = "md",
  className = "",
}: ConfidenceMeterProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clamp score to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(clampedScore * 100);

  const sizeConfig = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const barColor = getBarColor(clampedScore);
  const textColor = getTextColor(clampedScore);
  const trackColor = getBgTrackColor(clampedScore);
  const label = getConfidenceLabel(clampedScore);
  const tooltipDescription = getTooltipDescription(clampedScore);

  const ariaLabel = `AI confidence score: ${percentage}% (${label})`;

  const handleMouseEnter = useCallback(() => {
    if (showTooltip) {
      setIsTooltipVisible(true);
    }
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (showTooltip) {
      setIsTooltipVisible(true);
    }
  }, [showTooltip]);

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
      className={`relative inline-flex items-center gap-2 ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={showTooltip ? 0 : undefined}
      role="meter"
      aria-label={ariaLabel}
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-describedby={showTooltip ? "confidence-tooltip" : undefined}
    >
      {/* Progress bar */}
      <div className={`flex-1 min-w-[60px] ${trackColor} ${sizeConfig.bar} overflow-hidden`}>
        <div
          className={`${barColor} ${sizeConfig.height} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={`${sizeConfig.text} font-medium ${textColor} whitespace-nowrap`}
          aria-hidden="true"
        >
          {percentage}%
          <span className="ml-1 font-normal text-gray-500">
            ({label})
          </span>
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && isTooltipVisible && (
        <div
          ref={tooltipRef}
          id="confidence-tooltip"
          role="tooltip"
          className={`absolute ${sizeConfig.tooltipOffset} left-0 z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${barColor}`}
              aria-hidden="true"
            />
            <span className={`text-xs font-semibold ${textColor}`}>
              {label} Confidence ({percentage}%)
            </span>
          </div>
          <p className="text-xs leading-relaxed text-gray-600">
            {tooltipDescription}
          </p>
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-400">
              Score is based on knowledge base context match, listing relevance, and response quality.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfidenceMeter;