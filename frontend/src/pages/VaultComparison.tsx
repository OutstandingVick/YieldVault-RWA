import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { Check, Layers, ShieldCheck, TrendingUp } from "../components/icons";
import {
  MAX_VAULT_COMPARISON_SELECTION,
  VAULT_STRATEGIES,
  type VaultStrategyOption,
} from "../data/vaultStrategies";

const STRATEGIES_PARAM = "strategies";

function parseStrategiesParam(raw: string | null): string[] {
  if (!raw) return [];
  const validIds = new Set(VAULT_STRATEGIES.map((strategy) => strategy.id));
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw.split(",")) {
    const id = value.trim();
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.slice(0, MAX_VAULT_COMPARISON_SELECTION);
}

function parseApy(apy: string): number {
  const parsed = Number.parseFloat(apy.replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

const VaultComparison: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const fromUrl = parseStrategiesParam(searchParams.get(STRATEGIES_PARAM));
    return fromUrl.length > 0 ? fromUrl : [VAULT_STRATEGIES[0].id, VAULT_STRATEGIES[1].id];
  });

  const selectedStrategies = useMemo(
    () => VAULT_STRATEGIES.filter((strategy) => selectedIds.includes(strategy.id)),
    [selectedIds],
  );

  const atMaxSelection = selectedIds.length >= MAX_VAULT_COMPARISON_SELECTION;

  const bestApyId = useMemo(() => {
    if (selectedStrategies.length === 0) return null;
    return selectedStrategies.reduce((best, strategy) =>
      parseApy(strategy.apy) > parseApy(best.apy) ? strategy : best,
    ).id;
  }, [selectedStrategies]);

  const toggleStrategy = (id: string) => {
    let next: string[];
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((value) => value !== id);
    } else if (atMaxSelection) {
      return;
    } else {
      next = [...selectedIds, id];
    }

    setSelectedIds(next);
    setSearchParams(
      (params) => {
        const nextParams = new URLSearchParams(params);
        if (next.length > 0) {
          nextParams.set(STRATEGIES_PARAM, next.join(","));
        } else {
          nextParams.delete(STRATEGIES_PARAM);
        }
        return nextParams;
      },
      { replace: true },
    );
  };

  const comparisonRows = [
    { label: "APY", value: (strategy: VaultStrategyOption) => strategy.apy },
    { label: "Liquidity", value: (strategy: VaultStrategyOption) => strategy.liquidity },
    { label: "Lockup", value: (strategy: VaultStrategyOption) => strategy.lockup },
    { label: "Risk", value: (strategy: VaultStrategyOption) => strategy.risk },
    { label: "Settlement", value: (strategy: VaultStrategyOption) => strategy.settlement },
  ];

  return (
    <div className="glass-panel" style={{ padding: "32px" }}>
      <PageHeader
        title={
          <>
            Compare <span className="text-gradient">Vault Strategies</span>
          </>
        }
        description="Select multiple strategies to compare yield, liquidity, and risk before you allocate capital."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Vault Comparison" }]}
        statusChips={[{ label: `${selectedStrategies.length} selected`, variant: "cyan" }]}
      />

      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "24px" }}>
        {VAULT_STRATEGIES.map((strategy) => {
          const selected = selectedIds.includes(strategy.id);

          return (
            <button
              key={strategy.id}
              type="button"
              onClick={() => toggleStrategy(strategy.id)}
              aria-pressed={selected}
              aria-disabled={!selected && atMaxSelection ? true : undefined}
              style={{
                textAlign: "left",
                padding: "18px",
                borderRadius: "16px",
                border: selected ? `1px solid ${strategy.accent}` : "1px solid var(--border-glass)",
                background: selected ? "rgba(0, 240, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                color: "inherit",
                cursor: !selected && atMaxSelection ? "not-allowed" : "pointer",
                opacity: !selected && atMaxSelection ? 0.6 : 1,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                minHeight: "220px",
              }}
            >
              <div className="flex items-start justify-between gap-md">
                <div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {strategy.issuer}
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "4px" }}>{strategy.name}</div>
                </div>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: `1px solid ${selected ? strategy.accent : "var(--border-glass)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: selected ? strategy.accent : "var(--text-secondary)",
                  }}
                >
                  {selected ? <Check size={14} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />}
                </div>
              </div>

              <div style={{ display: "grid", gap: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-sm"><TrendingUp size={14} color={strategy.accent} /> APY {strategy.apy}</div>
                <div className="flex items-center gap-sm"><ShieldCheck size={14} color={strategy.accent} /> Risk {strategy.risk}</div>
                <div className="flex items-center gap-sm"><Layers size={14} color={strategy.accent} /> Liquidity {strategy.liquidity}</div>
              </div>

              <div style={{ marginTop: "auto", color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                {strategy.note}
              </div>
            </button>
          );
        })}
      </div>

      {selectedStrategies.length < 2 ? (
        <EmptyState
          kind="search"
          title="Select at least two strategies"
          description="Choose two or three vault strategies to unlock a side-by-side comparison."
          icon={<Layers size={24} />}
          action={{ label: "Back to vault", onClick: () => navigate("/"), variant: "secondary" }}
        />
      ) : (
        <section className="glass-panel" style={{ padding: "24px", background: "var(--bg-muted)" }}>
          <div className="flex items-center justify-between gap-md" style={{ marginBottom: "16px" }}>
            <div>
              <h2 style={{ marginBottom: "4px" }}>Side-by-side comparison</h2>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Compare the selected strategies across yield, liquidity, and risk signals.
              </p>
            </div>
            <div className="flex items-center gap-sm">
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>Back to vault</button>
              <button type="button" className="btn btn-primary" onClick={() => navigate("/?tab=deposit")}>
                Allocate to selected
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption className="sr-only">Selected vault strategy comparison</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: "12px", color: "var(--text-secondary)" }}>Metric</th>
                  {selectedStrategies.map((strategy) => (
                    <th key={strategy.id} scope="col" style={{ textAlign: "left", padding: "12px" }}>{strategy.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" style={{ textAlign: "left", padding: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
                      {row.label}
                    </th>
                    {selectedStrategies.map((strategy) => {
                      const isBestApy = row.label === "APY" && strategy.id === bestApyId;

                      return (
                        <td
                          key={`${strategy.id}-${row.label}`}
                          data-best={isBestApy ? "true" : undefined}
                          style={{
                            padding: "12px",
                            borderTop: "1px solid var(--border-glass)",
                            ...(isBestApy
                              ? {
                                  color: "var(--accent-green)",
                                  fontWeight: 700,
                                  background: "rgba(0, 255, 163, 0.08)",
                                }
                              : {}),
                          }}
                        >
                          {row.value(strategy)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default VaultComparison;
