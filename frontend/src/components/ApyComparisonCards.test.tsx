import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ApyComparisonCards from "./ApyComparisonCards";
import { VaultProvider } from "../context/VaultContext";
import { PreferencesProvider } from "../context/PreferencesContext";
import * as vaultDataHooks from "../hooks/useVaultData";
import type { UseQueryResult } from "@tanstack/react-query";
import type { VaultSummary } from "../lib/vaultApi";
import type { VaultHistoryPoint } from "../lib/vaultApi";

vi.mock("../hooks/useVaultData", () => ({
  useVaultSummary: vi.fn(),
  useVaultHistory: vi.fn(),
}));

const mockSummary: VaultSummary = {
  tvl: 12450800,
  depositCap: 15000000,
  apy: 8.45,
  participantCount: 1248,
  monthlyGrowthPct: 12.5,
  strategyStabilityPct: 99.9,
  assetLabel: "Sovereign Debt",
  exchangeRate: 1.084,
  networkFeeEstimate: "~0.00001 XLM",
  updatedAt: "2026-03-25T10:00:00.000Z",
  contractPaused: false,
  strategy: {
    id: "stellar-benji",
    name: "Franklin BENJI Connector",
    issuer: "Franklin Templeton",
    network: "Stellar",
    rpcUrl: "https://soroban-testnet.stellar.org",
    status: "active",
    description: "Connector strategy.",
  },
};

const mockHistory: VaultHistoryPoint[] = [
  { date: "2026-03-01", value: 100 },
  { date: "2026-03-25", value: 103.75 },
];

function renderCards() {
  vi.mocked(vaultDataHooks.useVaultSummary).mockReturnValue({
    data: mockSummary,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<VaultSummary, Error>);

  vi.mocked(vaultDataHooks.useVaultHistory).mockReturnValue({
    data: mockHistory,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<VaultHistoryPoint[], Error>);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PreferencesProvider>
          <VaultProvider>
            <ApyComparisonCards />
          </VaultProvider>
        </PreferencesProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ApyComparisonCards", () => {
  it("renders the comparison section heading", () => {
    renderCards();
    expect(
      screen.getByRole("heading", { name: /apy comparison/i }),
    ).toBeInTheDocument();
  });

  it("renders deterministic comparison cards with confidence badges", () => {
    renderCards();

    expect(screen.getByLabelText(/yieldvault apy comparison/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/us t-bills apy comparison/i)).toBeInTheDocument();
    expect(screen.getAllByText(/confidence/i).length).toBeGreaterThan(0);
    expect(screen.getByText("8.45%")).toBeInTheDocument();
    expect(screen.getByText("-3.20% vs vault")).toBeInTheDocument();
  });

  it("shows loading skeletons while data is loading", () => {
    vi.mocked(vaultDataHooks.useVaultSummary).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<VaultSummary, Error>);

    vi.mocked(vaultDataHooks.useVaultHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<VaultHistoryPoint[], Error>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <PreferencesProvider>
            <VaultProvider>
              <ApyComparisonCards />
            </VaultProvider>
          </PreferencesProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(container.querySelector(".skeleton")).not.toBeNull();
  });
});
