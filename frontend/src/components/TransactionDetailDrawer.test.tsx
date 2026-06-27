import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import { ToastProvider } from "../context/ToastContext";
import type { Transaction } from "../lib/transactionApi";

const VALID_HASH = "a".repeat(64);

vi.mock("../hooks/useTransactionTimeline", () => ({
  useTransactionTimeline: () => ({
    status: "pending",
    elapsedSeconds: 3,
    errorMessage: undefined,
    reset: vi.fn(),
  }),
}));

const mockTransaction: Transaction = {
  id: "tx-1",
  type: "deposit",
  status: "pending",
  amount: "100",
  asset: "USDC",
  timestamp: "2025-01-15T10:30:00Z",
  transactionHash: VALID_HASH,
};

function renderDrawer(
  transaction: Transaction | null = mockTransaction,
  isOpen = true,
) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <TransactionDetailDrawer
          transaction={transaction}
          isOpen={isOpen}
          onClose={onClose}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onClose };
}

describe("TransactionDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders transaction details when open", () => {
    renderDrawer();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    expect(screen.getByText("deposit")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("100 USDC")).toBeInTheDocument();
    expect(screen.getByText(VALID_HASH)).toBeInTheDocument();
  });

  it("renders explorer link with valid hash", () => {
    renderDrawer();

    const explorerLink = screen.getByRole("link", {
      name: /View on Stellar Explorer/i,
    });
    expect(explorerLink).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${VALID_HASH}`,
    );
    expect(explorerLink).toHaveAttribute("target", "_blank");
    expect(explorerLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders live status section for pending transactions", () => {
    renderDrawer();

    expect(screen.getByText("Live Status")).toBeInTheDocument();
    expect(screen.getByText(/Submitted/i)).toBeInTheDocument();
  });

  it("renders view receipt link", () => {
    renderDrawer();

    const receiptLink = screen.getByRole("link", { name: /View Receipt/i });
    expect(receiptLink).toHaveAttribute("href", `/receipt/${VALID_HASH}`);
  });

  it("calls onClose when close button is clicked", () => {
    const { onClose } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when transaction is null", () => {
    renderDrawer(null, true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
