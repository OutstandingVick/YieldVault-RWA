import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VaultDashboard from "../components/VaultDashboard";
import { VaultProvider } from "../context/VaultContext";
import { ToastProvider } from "../context/ToastContext";
import { PreferencesProvider } from "../context/PreferencesContext";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as vaultApi from "../lib/vaultApi";
import * as portfolioHooks from "../hooks/usePortfolioData";
import * as vaultDataHooks from "../hooks/useVaultData";
import * as tokenAllowanceHooks from "../hooks/useTokenAllowance";
import type { UseQueryResult } from "@tanstack/react-query";
import type { VaultSummary } from "../lib/vaultApi";

vi.mock("../lib/vaultApi", async (importOriginal) => {
  const actual = await importOriginal<typeof vaultApi>();
  return {
    ...actual,
    submitDeposit: vi.fn().mockResolvedValue(undefined),
    estimateNetworkFee: vi.fn().mockResolvedValue("0.05"),
  };
});

vi.mock("../hooks/useVaultMutations", () => ({
  useDepositMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useWithdrawMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

vi.mock("../hooks/usePortfolioData", () => ({
  usePortfolioHoldings: vi.fn(),
}));

vi.mock("../hooks/useVaultData", () => ({
  useVaultSummary: vi.fn(),
  useVaultHistory: vi.fn(),
}));

vi.mock("../hooks/useTokenAllowance", () => ({
  useTokenAllowance: vi.fn(),
}));

vi.mock("../hooks/useFeeEstimate", () => ({
  useFeeEstimate: () => ({
    feeXlm: 0.1,
    feeUsd: 0.01,
    isEstimating: false,
    isHighFee: false,
  }),
}));

vi.mock("../hooks/useTransactionConfirmation", () => ({
  useTransactionConfirmation: () => ({
    requestConfirmation: vi.fn().mockResolvedValue(true),
    modal: null,
    isOpen: false,
  }),
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Routes>
      <Route
        path="*"
        element={
          <QueryClientProvider client={queryClient}>
            <PreferencesProvider>
              <ToastProvider>
                <VaultProvider>
                  {children}
                </VaultProvider>
              </ToastProvider>
            </PreferencesProvider>
          </QueryClientProvider>
        }
      />
    </Routes>
  </BrowserRouter>
);

describe("VaultDashboard Wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(portfolioHooks.usePortfolioHoldings).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<unknown[], Error>);
    vi.mocked(vaultDataHooks.useVaultSummary).mockReturnValue({
      data: mockSummary,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<VaultSummary, Error>);
    vi.mocked(vaultDataHooks.useVaultHistory).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<{ date: string; value: number }[], Error>);
    vi.mocked(tokenAllowanceHooks.useTokenAllowance).mockReturnValue({
      approvalStatus: "idle",
      needsApproval: () => false,
      approve: vi.fn(),
      resetApproval: vi.fn(),
    } as ReturnType<typeof tokenAllowanceHooks.useTokenAllowance>);
  });

  it("navigates through the deposit wizard steps", async () => {
    render(
      <Wrapper>
        <VaultDashboard walletAddress="GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" usdcBalance={100} xlmBalance={10} />
      </Wrapper>
    );

    expect(await screen.findByText("Amount to deposit")).toBeInTheDocument();
    const input = screen.getByLabelText("Deposit amount");
    fireEvent.change(input, { target: { value: "10" } });

    fireEvent.click(screen.getByText("Review Transaction"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Transaction")).toBeInTheDocument();
    });
    expect(screen.getByText("10.00 USDC")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));

    expect(screen.getByText("Amount to deposit")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Review Transaction"));

    fireEvent.click(screen.getByText("Confirm deposit"));

    await waitFor(() => {
      expect(screen.getByText("Transaction Successful")).toBeInTheDocument();
    });
  });
});
