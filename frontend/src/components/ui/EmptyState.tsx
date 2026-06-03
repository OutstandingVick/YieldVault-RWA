import React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, PackageSearch, ShieldCheck } from "../icons";
import "./EmptyState.css";

export type EmptyStateKind =
  | "no-data"
  | "no-results"
  | "search"
  | "error"
  | "permission";

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
};

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  kind?: EmptyStateKind;
  /** @deprecated Prefer `kind`. `default` and `minimal` map to `no-data` and `no-results`. */
  variant?: EmptyStateKind | "default" | "minimal";
  className?: string;
}

const variantDefaults: Record<
  EmptyStateKind,
  {
    title: string;
    description: string;
    icon: LucideIcon;
  }
> = {
  "no-data": {
    title: "No data available",
    description: "There is nothing to show here yet.",
    icon: Inbox,
  },
  "no-results": {
    title: "No results found",
    description: "Try adjusting your search or filters.",
    icon: PackageSearch,
  },
  search: {
    title: "No results found",
    description: "Try adjusting your search or filters.",
    icon: PackageSearch,
  },
  error: {
    title: "Something went wrong",
    description: "We could not load this information. Please try again.",
    icon: AlertCircle,
  },
  permission: {
    title: "Access required",
    description: "Connect your wallet or check your permissions to continue.",
    icon: ShieldCheck,
  },
};

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
  if (variant === "search") {
    return "search";
  }
  if (variant === "error") {
    return "error";
  }
  if (variant === "permission") {
    return "permission";
  }
  return "no-data";
}

function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

function EmptyStateActionButton({
  action,
  defaultVariant = "primary",
}: {
  action: EmptyStateAction;
  defaultVariant?: EmptyStateAction["variant"];
}) {
  const variant = action.variant ?? defaultVariant;
  const className = `btn btn-${variant} empty-state-action`;

  if (action.href) {
    if (isExternalHref(action.href)) {
      return (
        <a
          href={action.href}
          className={className}
          onClick={action.onClick}
          target="_blank"
          rel="noopener noreferrer"
        >
          {action.label}
        </a>
      );
    }

    return (
      <a href={action.href} className={className} onClick={action.onClick}>
        {action.label}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  secondaryAction,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  kind,
  variant,
  className = "",
}) => {
  const resolvedKind = resolveKind(kind, variant);
  const defaults = variantDefaults[resolvedKind];
  const DefaultIcon = defaults.icon;
  const stateTitle = title ?? defaults.title;
  const stateDescription = description ?? defaults.description;
  const isError = resolvedKind === "error";
  const primaryAction =
    action ??
    (actionLabel && onAction
      ? { label: actionLabel, onClick: onAction }
      : undefined);
  const resolvedSecondaryAction =
    secondaryAction ??
    (secondaryActionLabel && onSecondaryAction
      ? {
          label: secondaryActionLabel,
          onClick: onSecondaryAction,
          variant: "secondary" as const,
        }
      : undefined);

  return (
    <section
      className={`empty-state-container empty-state-${resolvedKind} ${className}`.trim()}
      role={isError ? "alert" : "status"}
      aria-label={stateTitle}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div className="empty-state-icon-wrapper" aria-hidden="true">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
              size:
                resolvedKind === "no-results" || resolvedKind === "search"
                  ? 32
                  : 40,
            })
          : icon ?? (
              <DefaultIcon
                size={
                  resolvedKind === "no-results" || resolvedKind === "search"
                    ? 32
                    : 40
                }
                aria-hidden
              />
            )}
      </div>
      <h3 className="empty-state-title">{stateTitle}</h3>
      <p className="empty-state-description">{stateDescription}</p>
      {(primaryAction || resolvedSecondaryAction) && (
        <div className="empty-state-actions">
          {primaryAction && (
            <EmptyStateActionButton action={primaryAction} />
          )}
          {resolvedSecondaryAction && (
            <EmptyStateActionButton
              action={resolvedSecondaryAction}
              defaultVariant="secondary"
            />
          )}
        </div>
      )}
    </section>
  );
};

export default EmptyState;
