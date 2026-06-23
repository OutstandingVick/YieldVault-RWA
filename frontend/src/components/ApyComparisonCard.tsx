import React from "react";
import Badge, { type BadgeColor } from "./Badge";
import { formatPercent } from "../lib/formatters";
import type { ApyComparisonCardModel } from "../lib/apyComparison";
import type { ConfidenceLevel } from "../lib/apyConfidence";

const CONFIDENCE_COLORS: Record<ConfidenceLevel, BadgeColor> = {
  high: "success",
  medium: "warning",
  low: "error",
};

export interface ApyComparisonCardProps {
  card: ApyComparisonCardModel;
  locale?: string;
  isBaseline?: boolean;
}

const ApyComparisonCard: React.FC<ApyComparisonCardProps> = ({
  card,
  locale = "en-US",
  isBaseline = false,
}) => {
  const deltaPrefix = card.deltaVsVault > 0 ? "+" : "";
  const deltaColor =
    card.deltaVsVault > 0
      ? "var(--accent-cyan)"
      : card.deltaVsVault < 0
        ? "var(--text-error)"
        : "var(--text-secondary)";

  return (
    <article
      className="glass-panel"
      aria-label={`${card.label} APY comparison`}
      style={{
        flex: "1 1 220px",
        padding: "20px",
        background: "var(--bg-muted)",
        border: "1px solid var(--border-glass)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        <div>
          <div
            className="text-body-sm"
            style={{ color: "var(--text-secondary)", marginBottom: "4px" }}
          >
            {card.source}
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{card.label}</h3>
        </div>
        <Badge
          variant="status"
          color={CONFIDENCE_COLORS[card.confidence.level]}
          size="compact"
          aria-label={card.confidence.label}
        >
          {card.confidence.label}
        </Badge>
      </div>

      <div
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          color: "var(--text-primary)",
        }}
      >
        {formatPercent(card.apy, { locale, maximumFractionDigits: 2 })}
      </div>

      <div style={{ fontSize: "0.82rem", color: deltaColor, fontWeight: 600 }}>
        {isBaseline
          ? "Baseline for comparison"
          : `${deltaPrefix}${card.deltaVsVault.toFixed(2)}% vs vault`}
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--text-tertiary)",
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span>Recency {card.confidence.recencyScore}%</span>
        <span>Completeness {card.confidence.completenessScore}%</span>
      </div>
    </article>
  );
};

export default ApyComparisonCard;
