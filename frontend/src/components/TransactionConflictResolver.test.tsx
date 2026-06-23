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

    fireEvent.click(screen.getByRole("button", { name: "Use updated values" }));
    expect(onResolve).toHaveBeenCalledWith("update-values");
  });
});
