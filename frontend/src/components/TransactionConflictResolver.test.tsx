import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TransactionConflictResolver from "./TransactionConflictResolver";

describe("TransactionConflictResolver", () => {
  it("renders stale form resolution actions", () => {
    const onResolve = vi.fn();

    render(
      <TransactionConflictResolver
        conflict={{
          type: "stale-form",
          message: "Balance changed while reviewing.",
        }}
        staleChanges={[
          {
            field: "availableBalance",
            label: "Available balance",
            previous: "100.00 USDC",
            current: "90.00 USDC",
          },
        ]}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText("Transaction details changed")).toBeInTheDocument();
    expect(screen.getByText(/Available balance:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use updated values" }));
    expect(onResolve).toHaveBeenCalledWith("update-values");
  });

  it("renders wallet-in-progress resolution actions", () => {
    const onResolve = vi.fn();

    render(
      <TransactionConflictResolver
        conflict={{
          type: "wallet-in-progress",
          message: "Another operation is already in progress for this wallet",
        }}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onResolve).toHaveBeenCalledWith("retry");
  });

  it("renders idempotency conflict resolution actions", () => {
    const onResolve = vi.fn();

    render(
      <TransactionConflictResolver
        conflict={{
          type: "idempotency-conflict",
          message: "Idempotency key already used for a different request body",
        }}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use new intent" }));
    expect(onResolve).toHaveBeenCalledWith("new-intent");
  });
});
