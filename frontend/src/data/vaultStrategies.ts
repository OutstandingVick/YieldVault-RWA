export type VaultStrategyOption = {
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

export const MAX_VAULT_COMPARISON_SELECTION = 3;

// Mock catalog for now; wiring these strategies to the API is future work.
export const VAULT_STRATEGIES: VaultStrategyOption[] = [
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
