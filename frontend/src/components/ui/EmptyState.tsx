import React from "react";
import "./EmptyState.css";

export type EmptyStateKind = "no-data" | "no-results" | "error";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  kind?: EmptyStateKind;
  /** @deprecated Prefer `kind`. `default` and `minimal` map to `no-data` and `no-results`. */
  variant?: EmptyStateKind | "default" | "minimal";
  className?: string;
}

function resolveKind(
  kind?: EmptyStateKind,
  variant?: EmptyStateProps["variant"],
): EmptyStateKind {
  if (kind) {
    return kind;
  }
  if (variant === "minimal" || variant === "no-results") {
    return "no-results";
  }
  if (variant === "error") {
    return "error";
  }
  return "no-data";
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  kind,
  variant,
  className = "",
}) => {
  const resolvedKind = resolveKind(kind, variant);
  const isError = resolvedKind === "error";
  const hasPrimaryAction = Boolean(actionLabel && onAction);
  const hasSecondaryAction = Boolean(
    secondaryActionLabel && onSecondaryAction,
  );

  return (
    <div
      className={`empty-state-container empty-state-${resolvedKind} ${className}`.trim()}
      role={isError ? "alert" : "status"}
      aria-label={title}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div className="empty-state-icon-wrapper" aria-hidden="true">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
              size: resolvedKind === "no-results" ? 32 : 40,
            })
          : icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {(hasPrimaryAction || hasSecondaryAction) && (
        <div className="empty-state-actions">
          {hasPrimaryAction && (
            <button
              type="button"
              className="btn btn-primary empty-state-action"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          {hasSecondaryAction && (
            <button
              type="button"
              className="btn btn-primary empty-state-action"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
