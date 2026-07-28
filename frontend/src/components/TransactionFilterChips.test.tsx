import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TransactionFilterChips from "./TransactionFilterChips";
import { describeActiveFilters, EMPTY_TRANSACTION_FILTERS } from "../lib/transactionQuery";
import type { ActiveFilterDescriptor } from "../lib/transactionQuery";

function renderChips(chips: ActiveFilterDescriptor[]) {
  const onRemove = vi.fn();
  const view = render(
    <TransactionFilterChips chips={chips} onRemove={onRemove} />,
  );
  return { ...view, onRemove };
}

describe("TransactionFilterChips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no filters are applied", () => {
    const { container } = renderChips([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels each chip with its filter name and value", () => {
    renderChips(
      describeActiveFilters({
        ...EMPTY_TRANSACTION_FILTERS,
        asset: "USDC",
        amountMin: "50",
      }),
    );

    expect(screen.getByText("Asset: USDC")).toBeInTheDocument();
    expect(screen.getByText("Min amount: 50")).toBeInTheDocument();
  });

  it("translates type and status values rather than showing raw enum values", () => {
    renderChips(
      describeActiveFilters({
        ...EMPTY_TRANSACTION_FILTERS,
        types: ["withdrawal"],
        statuses: ["failed"],
      }),
    );

    expect(screen.getByText("Type: Withdrawal")).toBeInTheDocument();
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
  });

  it("removes one filter without touching the others", () => {
    const chips = describeActiveFilters({
      ...EMPTY_TRANSACTION_FILTERS,
      types: ["deposit", "withdrawal"],
    });
    const { onRemove } = renderChips(chips);

    fireEvent.click(
      screen.getByRole("button", { name: /Type: Deposit, remove this filter/i }),
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(chips[0]);
  });

  it("groups the chips under an accessible name", () => {
    renderChips(
      describeActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, search: "abc" }),
    );

    expect(
      screen.getByRole("group", { name: /Active filters/i }),
    ).toBeInTheDocument();
  });

  it("renders one chip per selected value", () => {
    renderChips(
      describeActiveFilters({
        ...EMPTY_TRANSACTION_FILTERS,
        types: ["deposit", "withdrawal", "trade"],
      }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
