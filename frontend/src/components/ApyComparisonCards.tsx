import React, { useMemo } from "react";
import { Percent } from "./icons";
import { useTranslation } from "../i18n";
import { usePreferencesContext } from "../context/PreferencesContext";
import { useVault } from "../context/VaultContext";
import { useVaultHistory } from "../hooks/useVaultData";
import { buildApyComparisons } from "../lib/apyComparison";
import ApyComparisonCard from "./ApyComparisonCard";
import Skeleton from "./Skeleton";

const ApyComparisonCards: React.FC = () => {
  const { summary, isLoading: isVaultLoading } = useVault();
  const { data: history, isLoading: isHistoryLoading } = useVaultHistory();
  const { preferences } = usePreferencesContext();
  const { t } = useTranslation();

  const isLoading = isVaultLoading || isHistoryLoading;

  const cards = useMemo(
    () =>
      buildApyComparisons({
        vaultApy: summary.apy,
        vaultUpdatedAt: summary.updatedAt,
        vaultHistoryPointCount: history?.length ?? 0,
      }),
    [summary.apy, summary.updatedAt, history],
  );

  return (
    <section
      className="glass-panel"
      style={{ padding: "24px", background: "var(--bg-muted)" }}
      aria-labelledby="apy-comparison-heading"
    >
      <header style={{ marginBottom: "16px" }}>
        <h2
          id="apy-comparison-heading"
          style={{
            fontSize: "1.1rem",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Percent size={18} color="var(--accent-cyan)" />
          {t("analytics.apyComparison.title")}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
          {t("analytics.apyComparison.description")}
        </p>
      </header>

      <div
        className="flex gap-md"
        style={{ flexWrap: "wrap" }}
        role="list"
        aria-label={t("analytics.apyComparison.listLabel")}
      >
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={`apy-comparison-skeleton-${index}`}
                className="glass-panel"
                style={{
                  flex: "1 1 220px",
                  padding: "20px",
                  background: "var(--bg-muted)",
                }}
              >
                <Skeleton width="60%" height="1rem" />
                <div style={{ marginTop: "12px" }}>
                  <Skeleton width="40%" height="2rem" />
                </div>
              </div>
            ))
          : cards.map((card) => (
              <div key={card.id} role="listitem" style={{ flex: "1 1 220px" }}>
                <ApyComparisonCard
                  card={card}
                  locale={preferences.locale}
                  isBaseline={card.id === "vault"}
                />
              </div>
            ))}
      </div>
    </section>
  );
};

export default ApyComparisonCards;
