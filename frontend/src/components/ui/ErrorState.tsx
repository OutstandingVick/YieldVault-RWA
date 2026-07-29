import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Info, RefreshCw } from "../icons";
import "./ErrorState.css";

export type ErrorTone = "error" | "warning" | "info";

export interface ErrorStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string | null;
  tone?: ErrorTone;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ErrorStateAction;
  secondaryAction?: ErrorStateAction;
  className?: string;
  style?: React.CSSProperties;
  showDetailsToggle?: boolean;
}

function getSafeErrorMessage(error?: Error | string | null): string | null {
  if (!error) return null;
  const msg = typeof error === "string" ? error : error.message;
  if (!msg) return null;
  const trimmed = msg.trim();
  // Filter out internal stack frames or code paths for production safety if necessary
  if (/[/\\]|\.tsx?\b|\.jsx?\b|at\s+\S+/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "An error occurred while loading this section. Please try again.",
  error,
  tone = "error",
  onRetry,
  retryLabel = "Try Again",
  action,
  secondaryAction,
  className = "",
  style,
  showDetailsToggle = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const detail = getSafeErrorMessage(error);

  const IconComponent =
    tone === "warning" ? AlertTriangle : tone === "info" ? Info : AlertCircle;

  const primaryAction =
    action ??
    (onRetry
      ? {
          label: retryLabel,
          onClick: onRetry,
          variant: "primary" as const,
        }
      : undefined);

  return (
    <section
      className={`error-state-container error-state-tone-${tone} ${className}`.trim()}
      role="alert"
      aria-live="assertive"
      style={style}
    >
      <div className="error-state-icon-wrapper" aria-hidden="true">
        <IconComponent size={28} />
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-description">{description}</p>

      {showDetailsToggle && detail && (
        <>
          <button
            type="button"
            className="error-state-details-toggle"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Hide technical details" : "Show technical details"}
          </button>
          {showDetails && (
            <div
              className="error-state-details-box"
              data-testid="error-state-detail"
            >
              {detail}
            </div>
          )}
        </>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="error-state-actions">
          {primaryAction && (
            <button
              type="button"
              className={`btn btn-${primaryAction.variant ?? "primary"} error-state-action-btn`}
              onClick={primaryAction.onClick}
            >
              {onRetry && primaryAction.label === retryLabel && (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className={`btn btn-${secondaryAction.variant ?? "secondary"} error-state-action-btn`}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ErrorState;
