import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import VaultDashboard from "./VaultDashboard";
import { VaultProvider } from "../context/VaultContext";
import { ToastProvider } from "../context/ToastContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as vaultMutations from "../hooks/useVaultMutations";

vi.mock("../hooks/useVaultMutations", () => ({
  useDepositMutation: vi.fn(),
  useWithdrawMutation: vi.fn(),
}));

const mockSummary = {
  tvl: 12450800,
  apy: 8.45,
  participantCount: 1248,
  monthlyGrowthPct: 12.5,
  strategyStabilityPct: 99.9,
  assetLabel: "Sovereign Debt",
  exchangeRate: 1.084,
  networkFeeEstimate: "~0.00001 XLM",
  updatedAt: "2026-03-25T10:00:00.000Z",
  depositCap: 15000000,
  strategy: {
    id: "stellar-benji",
    name: "Franklin BENJI Connector",
    issuer: "Franklin Templeton",
    network: "Stellar",
    rpcUrl: "https://soroban-testnet.stellar.org",
    status: "active" as const,
    description:
      "Connector strategy that routes vault yield updates from BENJI-issued tokenized money market exposure on Stellar.",
  },
};

function createMockMutation() {
  return {
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
    isError: false,
    error: null,
  };
}

function renderDashboard(walletAddress: string | null, usdcBalance = 1250.5) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <VaultProvider>
          <VaultDashboard walletAddress={walletAddress} usdcBalance={usdcBalance} />
        </VaultProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("VaultDashboard", () => {
  let mockDeposit: any;
  let mockWithdraw: any;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    
    mockDeposit = createMockMutation();
    mockWithdraw = createMockMutation();
    
    vi.mocked(vaultMutations.useDepositMutation).mockReturnValue(mockDeposit);
    vi.mocked(vaultMutations.useWithdrawMutation).mockReturnValue(mockWithdraw);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockSummary), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the connect overlay when wallet is not connected", async () => {
    renderDashboard(null);

    expect(screen.getByText(/Wallet Not Connected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Please connect your Freighter wallet/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Franklin BENJI Connector/i),
    ).toBeInTheDocument();
  });

  it("renders the dashboard when wallet is connected", async () => {
    renderDashboard("GABC123");

    expect(screen.queryByText(/Wallet Not Connected/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Global RWA Yield Fund/i)).toBeInTheDocument();
    expect(screen.getByText(/Current APY/i)).toBeInTheDocument();

    expect(await screen.findByText(/Sovereign Debt/i)).toBeInTheDocument();
    expect(screen.getByText(/Strategy ID:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy strategy ID/i })).toBeInTheDocument();
  });

  it("allows switching between deposit and withdraw tabs", async () => {
    renderDashboard("GABC123");

    expect(await screen.findByText(/Approve & Deposit/i)).toBeInTheDocument();

    const depositTab = screen.getByText("Deposit");
    const withdrawTab = screen.getByText("Withdraw");

    fireEvent.click(withdrawTab);
    expect(screen.getByText(/Amount to withdraw/i)).toBeInTheDocument();

    fireEvent.click(depositTab);
    expect(screen.getByText(/Amount to deposit/i)).toBeInTheDocument();
  });

  it("updates the amount input and processes a deposit", async () => {
    renderDashboard("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    expect(await screen.findByText(/Approve & Deposit/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100" } });
    expect(input).toHaveValue(100);

    const button = screen.getByText("Approve & Deposit");
    fireEvent.click(button);

    expect(mockDeposit.mutateAsync).toHaveBeenCalledWith({
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      amount: 100,
    });

    await waitFor(() => {
      expect(screen.getByText(/Deposit Successful/i)).toBeInTheDocument();
    });
  });

  it("fills the input with max allowable amount via MAX button", async () => {
    renderDashboard("GABC123");

    expect(await screen.findByText(/Approve & Deposit/i)).toBeInTheDocument();

    const maxButton = screen.getByRole("button", { name: "MAX" });
    fireEvent.click(maxButton);
    const input = screen.getByPlaceholderText("0.00");
    expect(input).toHaveValue(1250.5);

    fireEvent.click(screen.getByRole("tab", { name: "Withdraw" }));
    fireEvent.click(maxButton);
    expect(input).toHaveValue(1250.5);
  });

  it("prevents transactions above the max allowable amount", async () => {
    renderDashboard("GABC123");

    expect(await screen.findByText(/Approve & Deposit/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve & Deposit" }));

    await waitFor(() => {
      expect(screen.getByText(/Amount exceeds maximum/i)).toBeInTheDocument();
    });
    expect(mockDeposit.mutateAsync).not.toHaveBeenCalled();
  });

  it("prevents withdrawals above the available balance", async () => {
    renderDashboard("GABC123", 500);

    const withdrawTab = screen.getByRole("tab", { name: "Withdraw" });
    fireEvent.click(withdrawTab);

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw Funds" }));

    await waitFor(() => {
      expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
    });
    expect(mockWithdraw.mutateAsync).not.toHaveBeenCalled();
  });

  it("validates that amount must be greater than zero", async () => {
    renderDashboard("GABC123");

    const input = screen.getByPlaceholderText("0.00");
    const button = screen.getByRole("button", { name: "Approve & Deposit" });
    
    // Zero amount
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid amount/i)).toBeInTheDocument();
    });
    
    expect(mockDeposit.mutateAsync).not.toHaveBeenCalled();
  });

  it("validates that amount must be positive", async () => {
    renderDashboard("GABC123");

    const input = screen.getByPlaceholderText("0.00");
    const button = screen.getByRole("button", { name: "Approve & Deposit" });
    
    // Negative amount
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/Enter a valid amount/i)).toBeInTheDocument();
    });
    
    expect(mockDeposit.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows an error toast when the mutation fails", async () => {
    mockDeposit.mutateAsync.mockRejectedValue(new Error("RPC Error"));
    
    renderDashboard("GABC123");
    
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve & Deposit" }));
    
    await waitFor(() => {
      expect(screen.getByText(/Transaction Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/RPC Error/i)).toBeInTheDocument();
    });
  });

  it("shows a normalized API error message when data loading fails", async () => {
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    renderDashboard("GABC123");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Data unavailable");
    }, { timeout: 3000 });
    
    expect(screen.getByRole("alert")).toHaveTextContent("We could not reach the server. Check your connection and try again.");
  });
});
