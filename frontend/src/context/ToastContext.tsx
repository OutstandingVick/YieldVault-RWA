import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
  /** Unique key for deduplication. If not provided, deduplication uses title+description */
  dedupeKey?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
  duration: number;
  timestamp: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  success: (options: Omit<ToastOptions, "variant">) => string;
  error: (options: Omit<ToastOptions, "variant">) => string;
  warning: (options: Omit<ToastOptions, "variant">) => string;
  info: (options: Omit<ToastOptions, "variant">) => string;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATION = 5000;
const DEDUPE_WINDOW_MS = 3000; // Don't show duplicate toasts within 3 seconds

/**
 * Generate a deduplication key from toast content.
 * Toasts with the same key within DEDUPE_WINDOW_MS are considered duplicates.
 */
function generateDedupeKey(options: ToastOptions): string {
  if (options.dedupeKey) {
    return options.dedupeKey;
  }
  return `${options.title}|${options.description || ''}|${options.variant || 'info'}`;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastId = useRef(0);
  const timeoutRefs = useRef<Map<string, number>>(new Map());
  // Track recent toast keys for deduplication
  const recentToasts = useRef<Map<string, number>>(new Map());

  const dismissToast = (id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));

    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
  };

  const clearAll = () => {
    setToasts([]);
    timeoutRefs.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timeoutRefs.current.clear();
  };

  const showToast = ({
    variant = "info",
    duration = DEFAULT_DURATION,
    ...options
  }: ToastOptions) => {
    const dedupeKey = generateDedupeKey({ ...options, variant });
    const now = Date.now();

    // Check for duplicate within dedupe window
    const lastShown = recentToasts.current.get(dedupeKey);
    if (lastShown && now - lastShown < DEDUPE_WINDOW_MS) {
      // Duplicate detected - return the existing toast ID (we don't have it, so return empty)
      // In a production system, you might want to bump the existing toast or extend its duration
      return '';
    }

    // Record this toast for deduplication
    recentToasts.current.set(dedupeKey, now);

    nextToastId.current += 1;
    const id = `toast-${nextToastId.current}`;
    const nextToast: ToastItem = {
      id,
      variant,
      duration,
      timestamp: now,
      ...options,
    };

    setToasts((currentToasts) => [...currentToasts, nextToast]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(id);
    }, duration);

    timeoutRefs.current.set(id, timeoutId);
    return id;
  };

  // Clean up old dedupe entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleKeys: string[] = [];
      recentToasts.current.forEach((timestamp, key) => {
        if (now - timestamp > DEDUPE_WINDOW_MS) {
          staleKeys.push(key);
        }
      });
      staleKeys.forEach((key) => recentToasts.current.delete(key));
    }, DEDUPE_WINDOW_MS);

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    const timeouts = timeoutRefs.current;

    return () => {
      timeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeouts.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        dismissToast,
        clearAll,
        success: (options) => showToast({ ...options, variant: "success" }),
        error: (options) => showToast({ ...options, variant: "error" }),
        warning: (options) => showToast({ ...options, variant: "warning" }),
        info: (options) => showToast({ ...options, variant: "info" }),
      }}
    >
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.variant}`}
            role={toast.variant === "error" ? "alert" : "status"}
          >
            <div className="toast-copy">
              <div className="toast-title">{toast.title}</div>
              {toast.description && (
                <div className="toast-description">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              className="toast-dismiss"
              aria-label={`Dismiss ${toast.title}`}
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
