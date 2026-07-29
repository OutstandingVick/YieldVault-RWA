import React, { useId } from "react";
import { AlertTriangle } from "./icons";
import Badge from "./Badge";

export type RiskAction = {
  id: string;
  title: string;
  description: string;
  label: string;
  tone: "critical" | "warning" | "info" | "success";
  onClick: () => void;
};

export interface RiskSummaryCardProps {
  items: RiskAction[];
  /** Card heading, e.g. "Account Risk Summary". */
  title: string;
  /** Short line under the heading explaining how warnings are ordered. */
  subtitle: string;
  /** Badge label shown when there are no warnings, e.g. "All clear". */
  allClearLabel: string;
  /** Pre-formatted badge label shown when warnings exist, e.g. "2 warnings". */
  warningsLabel: string;
  /** Body copy shown in the all-clear state. */
  healthyMessage: string;
  /** Optional CTA rendered as a button in the all-clear state. */
  healthyAction?: { label: string; onClick: () => void };
}

/**
 * Presentational card summarizing account-level risk signals with one
 * actionable CTA per warning. All copy is provided via props so the parent
 * owns translation concerns.
 */
const RiskSummaryCard: React.FC<RiskSummaryCardProps> = ({
  items,
  title,
  subtitle,
  allClearLabel,
  warningsLabel,
  healthyMessage,
  healthyAction,
}) => {
  const headingId = useId();
  const hasWarnings = items.length > 0;

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      className="glass-panel"
      style={{
        padding: "20px",
        background: "var(--bg-muted)",
        border: "1px solid var(--border-glass)",
        marginBottom: "24px",
      }}
    >
      <div className="flex items-center justify-between gap-md" style={{ marginBottom: "16px" }}>
        <div>
          <h3
            id={headingId}
            style={{ marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <AlertTriangle size={18} color="var(--text-warning)" />
            {title}
          </h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            {subtitle}
          </p>
        </div>
        <Badge variant="pill" color={hasWarnings ? "warning" : "success"} size="compact">
          {hasWarnings ? warningsLabel : allClearLabel}
        </Badge>
      </div>

      <div aria-live="polite">
        {hasWarnings ? (
          <div style={{ display: "grid", gap: "12px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `1px solid ${item.tone === "critical" ? "rgba(255, 107, 107, 0.4)" : "var(--border-glass)"}`,
                  background: item.tone === "critical"
                    ? "rgba(255, 107, 107, 0.08)"
                    : item.tone === "warning"
                      ? "rgba(255, 159, 10, 0.08)"
                      : "rgba(0, 240, 255, 0.05)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{item.title}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {item.description}
                  </div>
                </div>
                <button
                  type="button"
                  className={item.tone === "critical" ? "btn btn-warning" : "btn btn-secondary"}
                  onClick={item.onClick}
                  style={{ alignSelf: "center", whiteSpace: "nowrap" }}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              background: "rgba(34, 197, 94, 0.08)",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            <div>{healthyMessage}</div>
            {healthyAction && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={healthyAction.onClick}
                style={{ marginTop: "12px", whiteSpace: "nowrap" }}
              >
                {healthyAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskSummaryCard;
