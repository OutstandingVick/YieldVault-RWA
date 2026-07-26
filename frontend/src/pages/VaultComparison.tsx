import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { Check, Layers, ShieldCheck, TrendingUp } from "../components/icons";

type StrategyOption = {
  id: string;
  name: string;
  issuer: string;
  apy: string;
  liquidity: string;
  lockup: string;
  risk: string;
  settlement: string;
  note: string;
  accent: string;
};

const STRATEGIES: StrategyOption[] = [
  {
    id: "benji",
    name: "Franklin BENJI Connector",
    issuer: "Franklin Templeton",
    apy: "8.45%",
    liquidity: "Daily",
    lockup: "None",
    risk: "Moderate",
    settlement: "T+0",
    note: "Current vault allocation with short-duration sovereign bond exposure.",
    accent: "var(--accent-cyan)",
  },
  {
    id: "treasury-ladder",
    name: "Tokenized Treasury Ladder",
    issuer: "OpenEden",
    apy: "7.90%",
    liquidity: "T+1",
    lockup: "None",
    risk: "Low",
    settlement: "T+1",
    note: "Prioritizes capital preservation and predictable liquidity windows.",
    accent: "var(--accent-green)",
  },
  {
    id: "credit-income",
    name: "Private Credit Income",
    issuer: "Ondo Finance",
    apy: "9.15%",
    liquidity: "Weekly",
    lockup: "7 days",
    risk: "Elevated",
    settlement: "T+2",
    note: "Higher yield profile with more settlement friction and monitoring.",
    accent: "var(--text-warning)",
  },
  {
    id: "liquidity-buffer",
    name: "Liquidity Buffer",
    issuer: "YieldVault Treasury",
    apy: "5.20%",
    liquidity: "Instant",
    lockup: "None",
    risk: "Very low",
    settlement: "Immediate",
    note: "Keeps most assets in reserve for rapid withdrawals and capital calls.",
    accent: "var(--accent-purple)",
  },
];

const MAX_SELECTION = 3;

const VaultComparison: React.FC = () => {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([STRATEGIES[0].id, STRATEGIES[1].id]);

  const selectedStrategies = useMemo(
    () => STRATEGIES.filter((strategy) => selectedIds.includes(strategy.id)),
    [selectedIds],
  );

  const toggleStrategy = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }

      if (current.length >= MAX_SELECTION) {
        return current;
      }

      return [...current, id];
    });
  };

  const comparisonRows = [
    { label: "APY", value: (strategy: StrategyOption) => strategy.apy },
    { label: "Liquidity", value: (strategy: StrategyOption) => strategy.liquidity },
    { label: "Lockup", value: (strategy: StrategyOption) => strategy.lockup },
    { label: "Risk", value: (strategy: StrategyOption) => strategy.risk },
    { label: "Settlement", value: (strategy: StrategyOption) => strategy.settlement },
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
        {STRATEGIES.map((strategy) => {
          const selected = selectedIds.includes(strategy.id);

          return (
            <button
              key={strategy.id}
              type="button"
              onClick={() => toggleStrategy(strategy.id)}
              aria-pressed={selected}
              style={{
                textAlign: "left",
                padding: "18px",
                borderRadius: "16px",
                border: selected ? `1px solid ${strategy.accent}` : "1px solid var(--border-glass)",
                background: selected ? "rgba(0, 240, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                color: "inherit",
                cursor: "pointer",
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
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>Back to vault</button>
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
                    {selectedStrategies.map((strategy) => (
                      <td key={`${strategy.id}-${row.label}`} style={{ padding: "12px", borderTop: "1px solid var(--border-glass)" }}>
                        {row.value(strategy)}
                      </td>
                    ))}
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