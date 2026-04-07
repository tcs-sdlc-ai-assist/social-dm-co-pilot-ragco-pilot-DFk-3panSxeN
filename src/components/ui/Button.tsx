"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Whether the button should take full width */
  fullWidth?: boolean;
  /** Optional icon to render before the label */
  leftIcon?: ReactNode;
  /** Optional icon to render after the label */
  rightIcon?: ReactNode;
  /** Button contents */
  children: ReactNode;
}

// ─── Variant Classes ─────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-stockland-green text-white hover:bg-stockland-green-light focus-visible:ring-stockland-green active:bg-stockland-green-dark",
  secondary:
    "border border-gray-200 bg-white text-stockland-charcoal hover:bg-gray-50 focus-visible:ring-stockland-green active:bg-gray-100",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 active:bg-red-800",
  ghost:
    "bg-transparent text-stockland-charcoal hover:bg-gray-100 focus-visible:ring-stockland-green active:bg-gray-200",
};

const VARIANT_DISABLED_CLASSES: Record<ButtonVariant, string> = {
  primary: "disabled:bg-gray-300 disabled:text-gray-500",
  secondary: "disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400",
  danger: "disabled:bg-red-200 disabled:text-red-400",
  ghost: "disabled:bg-transparent disabled:text-gray-300",
};

// ─── Size Classes ────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

// ─── Loading Spinner ─────────────────────────────────────────────────────────

function LoadingSpinner({ className }: { className: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Reusable button component with multiple variants, sizes, loading state,
 * and disabled state. Fully accessible with focus management.
 *
 * Variants:
 * - primary: Stockland green background with white text
 * - secondary: White background with border and charcoal text
 * - danger: Red background with white text
 * - ghost: Transparent background with charcoal text
 *
 * Sizes:
 * - sm: Compact padding and smaller text
 * - md: Default padding and text size
 * - lg: Larger padding and text size
 *
 * Usage:
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Save Changes
 * </Button>
 * <Button variant="secondary" isLoading>
 *   Processing...
 * </Button>
 * <Button variant="danger" leftIcon={<TrashIcon />}>
 *   Delete
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = "",
      disabled,
      type = "button",
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const baseClasses =
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

    const variantClasses = VARIANT_CLASSES[variant];
    const variantDisabledClasses = VARIANT_DISABLED_CLASSES[variant];
    const sizeClasses = SIZE_CLASSES[size];
    const iconSizeClasses = ICON_SIZE_CLASSES[size];
    const widthClasses = fullWidth ? "w-full" : "";

    const combinedClassName =
      `${baseClasses} ${variantClasses} ${variantDisabledClasses} ${sizeClasses} ${widthClasses} ${className}`.trim();

    return (
      <button
        ref={ref}
        type={type}
        className={combinedClassName}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...rest}
      >
        {isLoading ? (
          <LoadingSpinner className={iconSizeClasses} />
        ) : leftIcon ? (
          <span className={`flex-shrink-0 ${iconSizeClasses}`} aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}

        <span className={isLoading ? "opacity-70" : ""}>{children}</span>

        {!isLoading && rightIcon ? (
          <span className={`flex-shrink-0 ${iconSizeClasses}`} aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;