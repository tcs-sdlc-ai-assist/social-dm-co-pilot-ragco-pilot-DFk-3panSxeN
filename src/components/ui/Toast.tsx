"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  /** Unique identifier for the toast */
  id: string;
  /** Visual variant of the toast */
  variant: ToastVariant;
  /** Toast title (optional) */
  title?: string;
  /** Toast message content */
  message: string;
  /** Auto-dismiss timeout in milliseconds (default: 5000, 0 = no auto-dismiss) */
  duration?: number;
  /** Whether the toast can be manually dismissed (default: true) */
  dismissible?: boolean;
}

export interface ToastProps {
  /** The toast message to display */
  toast: ToastMessage;
  /** Callback when the toast is dismissed */
  onDismiss: (id: string) => void;
}

export interface ToastContainerProps {
  /** Position of the toast container */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  /** Maximum number of toasts to display at once */
  maxToasts?: number;
}

export interface ToastContextValue {
  /** Add a new toast */
  addToast: (toast: Omit<ToastMessage, "id">) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Remove all toasts */
  clearToasts: () => void;
  /** Shorthand: show a success toast */
  success: (message: string, title?: string, duration?: number) => string;
  /** Shorthand: show an error toast */
  error: (message: string, title?: string, duration?: number) => string;
  /** Shorthand: show an info toast */
  info: (message: string, title?: string, duration?: number) => string;
  /** Shorthand: show a warning toast */
  warning: (message: string, title?: string, duration?: number) => string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 5000;
const MAX_TOASTS_DEFAULT = 5;

let toastCounter = 0;

function generateToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

// ─── Variant Styles ──────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: string; title: string }> = {
  success: {
    container: "border-green-200 bg-green-50",
    icon: "text-green-500",
    title: "text-green-800",
  },
  error: {
    container: "border-red-200 bg-red-50",
    icon: "text-red-500",
    title: "text-red-800",
  },
  info: {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-500",
    title: "text-blue-800",
  },
  warning: {
    container: "border-yellow-200 bg-yellow-50",
    icon: "text-yellow-500",
    title: "text-yellow-800",
  },
};

const POSITION_STYLES: Record<string, string> = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function SuccessIcon({ className }: { className: string }) {
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
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className: string }) {
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
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className: string }) {
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
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className: string }) {
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
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className: string }) {
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
        d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function getVariantIcon(variant: ToastVariant, className: string): ReactNode {
  switch (variant) {
    case "success":
      return <SuccessIcon className={className} />;
    case "error":
      return <ErrorIcon className={className} />;
    case "info":
      return <InfoIcon className={className} />;
    case "warning":
      return <WarningIcon className={className} />;
    default:
      return <InfoIcon className={className} />;
  }
}

// ─── Toast Component ─────────────────────────────────────────────────────────

/**
 * Individual toast notification component.
 *
 * Displays a toast message with an icon, optional title, message text,
 * and an optional dismiss button. Auto-dismisses after the configured
 * duration unless duration is set to 0.
 *
 * Accessible with ARIA role="alert" for screen readers.
 *
 * Usage:
 * ```tsx
 * <Toast
 *   toast={{ id: "1", variant: "success", message: "Lead synced to Salesforce!" }}
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = toast.duration ?? DEFAULT_DURATION;
  const dismissible = toast.dismissible ?? true;
  const styles = VARIANT_STYLES[toast.variant] ?? VARIANT_STYLES.info;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  }, [onDismiss, toast.id]);

  // Enter animation
  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => {
      clearTimeout(enterTimer);
    };
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [duration, handleDismiss]);

  // Pause auto-dismiss on hover
  const handleMouseEnter = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }
  }, [duration, handleDismiss]);

  const visibilityClasses = isExiting
    ? "opacity-0 translate-x-4"
    : isVisible
      ? "opacity-100 translate-x-0"
      : "opacity-0 translate-x-4";

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 ease-in-out ${styles.container} ${visibilityClasses}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon */}
      <span className="flex-shrink-0">
        {getVariantIcon(toast.variant, `h-5 w-5 ${styles.icon}`)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-semibold ${styles.title}`}>
            {toast.title}
          </p>
        )}
        <p className={`text-sm text-gray-700 ${toast.title ? "mt-0.5" : ""}`}>
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
          aria-label="Dismiss notification"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── Toast Container ─────────────────────────────────────────────────────────

/**
 * Container component that renders all active toasts in a fixed position.
 * Must be placed inside a ToastProvider.
 *
 * Usage:
 * ```tsx
 * <ToastProvider>
 *   <App />
 *   <ToastContainer position="top-right" maxToasts={5} />
 * </ToastProvider>
 * ```
 */
export function ToastContainer({
  position = "top-right",
  maxToasts = MAX_TOASTS_DEFAULT,
}: ToastContainerProps) {
  const { toasts, removeToast } = useToastState();

  const positionClasses = POSITION_STYLES[position] ?? POSITION_STYLES["top-right"];

  // Limit the number of visible toasts
  const visibleToasts = toasts.slice(0, maxToasts);

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${positionClasses}`}
      aria-label="Notifications"
    >
      {visibleToasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}

// ─── Toast Context & Provider ────────────────────────────────────────────────

interface ToastStateContextValue {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const ToastStateContext = createContext<ToastStateContextValue | null>(null);

function useToastState(): ToastStateContextValue {
  const context = useContext(ToastStateContext);
  if (!context) {
    throw new Error("useToastState must be used within a ToastProvider.");
  }
  return context;
}

/**
 * Toast provider component that manages toast state.
 * Wrap your application (or a section of it) with this provider
 * to enable toast notifications.
 *
 * Usage:
 * ```tsx
 * <ToastProvider>
 *   <App />
 *   <ToastContainer position="top-right" />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">): string => {
    const id = generateToastId();
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? DEFAULT_DURATION,
      dismissible: toast.dismissible ?? true,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const success = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addToast({ variant: "success", message, title, duration });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addToast({
        variant: "error",
        message,
        title,
        duration: duration ?? 8000,
      });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addToast({ variant: "info", message, title, duration });
    },
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number): string => {
      return addToast({
        variant: "warning",
        message,
        title,
        duration: duration ?? 6000,
      });
    },
    [addToast]
  );

  const contextValue: ToastContextValue = {
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    info,
    warning,
  };

  const stateContextValue: ToastStateContextValue = {
    toasts,
    removeToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastStateContext.Provider value={stateContextValue}>
        {children}
      </ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Custom hook to access toast notification functions.
 * Must be used within a ToastProvider.
 *
 * Provides methods to show success, error, info, and warning toasts,
 * as well as generic addToast, removeToast, and clearToasts functions.
 *
 * Usage:
 * ```ts
 * const toast = useToast();
 *
 * // Shorthand methods
 * toast.success("Lead synced to Salesforce!", "Sync Complete");
 * toast.error("Failed to send draft.", "Send Error");
 * toast.info("Draft is ready for review.");
 * toast.warning("SLA breach approaching for DM from Sarah M.");
 *
 * // Generic method with full control
 * toast.addToast({
 *   variant: "success",
 *   title: "Salesforce Sync",
 *   message: "Lead successfully created in Salesforce.",
 *   duration: 6000,
 *   dismissible: true,
 * });
 *
 * // Remove a specific toast
 * const id = toast.success("Done!");
 * toast.removeToast(id);
 *
 * // Clear all toasts
 * toast.clearToasts();
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}

export default Toast;