import type { ReactNode } from "react";
import { AlertCircle, BarChart3 } from "lucide-react";
import EmptyState from "./EmptyState";
import "./ChartWidgetPlaceholder.css";

export type ChartWidgetPlaceholderVariant = "empty" | "error";

export interface ChartWidgetPlaceholderProps {
  variant: ChartWidgetPlaceholderVariant;
  title: string;
  description?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  height?: number | string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Deterministic placeholder for chart widgets when data is unavailable or loading failed.
 */
export function ChartWidgetPlaceholder({
  variant,
  title,
  description,
  icon,
  onRetry,
  retryLabel = "Retry",
  height = 220,
  className = "",
  "data-testid": testId,
}: ChartWidgetPlaceholderProps) {
  const defaultIcon =
    variant === "error" ? (
      <AlertCircle size={24} color="var(--text-error)" />
    ) : (
      icon ?? <BarChart3 size={24} />
    );

  return (
    <div
      className={`chart-widget-placeholder ${className}`.trim()}
      style={{ height, minHeight: height }}
      data-testid={testId ?? `chart-placeholder-${variant}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <EmptyState
        kind={variant === "error" ? "error" : "no-data"}
        className="empty-state-compact chart-widget-placeholder-content"
        title={title}
        description={description}
        icon={defaultIcon}
        action={
          onRetry
            ? { label: retryLabel, onClick: onRetry, variant: "secondary" }
            : undefined
        }
      />
    </div>
  );
}

export default ChartWidgetPlaceholder;
