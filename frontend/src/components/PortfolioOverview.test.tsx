import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import PortfolioOverview from "./PortfolioOverview";
import type { VaultHealthRecord } from "../lib/vaultHealthApi";

const mockUseVaultHealth = vi.fn();

vi.mock("../hooks/useVaultHealth", () => ({
  useVaultHealth: (...args: unknown[]) => mockUseVaultHealth(...args),
}));

const mockHealth: VaultHealthRecord[] = [
  {
    vaultId: "vault-1",
    name: "Stellar RWA Yield Fund",
    status: "healthy",
    latencyMs: 48,
    uptimePct: 99.98,
    lastCheckedAt: "2026-07-24T08:45:00.000Z",
    message: "All systems operational",
  },
  {
    vaultId: "vault-3",
    name: "Liquidity Ladder",
    status: "degraded",
    latencyMs: 420,
    uptimePct: 98.2,
    lastCheckedAt: "2026-07-24T08:45:00.000Z",
    message: "Elevated settlement latency",
  },
];

function renderOverview(
  overrides: Partial<ComponentProps<typeof PortfolioOverview>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PortfolioOverview
        totalValue={4627.76}
        totalGain={122.35}
        weightedApy={7.42}
        activePositions={4}
        holdingsCount={6}
        locale="en-US"
        formatSensitiveCurrency={(amount, withSign) => {
          const formatted = `$${amount.toFixed(2)}`;
          return withSign && amount >= 0 ? `+${formatted}` : formatted;
        }}
        referralStats={null}
        onShareClick={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("PortfolioOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVaultHealth.mockReturnValue({
      data: mockHealth,
      isLoading: false,
      isError: false,
    });
  });

  it("renders summary cards", () => {
    renderOverview();

    expect(screen.getByText("Total Net Value")).toBeInTheDocument();
    expect(screen.getByText("Cumulative Yield")).toBeInTheDocument();
    expect(screen.getByText("Weighted Avg APY")).toBeInTheDocument();
    expect(screen.getByText("Active Positions")).toBeInTheDocument();
    expect(screen.getByText("$4627.76")).toBeInTheDocument();
  });

  it("renders the Vault Health section with per-vault cards", () => {
    renderOverview();

    expect(screen.getByRole("heading", { name: "Vault Health" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Stellar RWA Yield Fund" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Liquidity Ladder" })).toBeInTheDocument();
    expect(screen.getByText("Elevated settlement latency")).toBeInTheDocument();
  });

  it("shows a loading message while vault health is fetching", () => {
    mockUseVaultHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderOverview();

    expect(screen.getByRole("status")).toHaveTextContent(/Loading vault health/i);
  });

  it("shows an error message when vault health fails", () => {
    mockUseVaultHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderOverview();

    expect(screen.getByRole("alert")).toHaveTextContent(/Unable to load vault health/i);
  });
});
