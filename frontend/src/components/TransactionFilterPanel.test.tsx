import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TransactionFilterPanel from "./TransactionFilterPanel";
import type { TransactionFilters } from "../hooks/useTransactionFilters";

function makeFilters(overrides: Partial<TransactionFilters> = {}): TransactionFilters {
  return {
    search: "",
    asset: "",
    types: [],
    statuses: [],
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<TransactionFilters> = {}, extraProps = {}) {
  const props = {
    filters: makeFilters(overrides),
    onSearchChange: vi.fn(),
    onTypesChange: vi.fn(),
    onStatusesChange: vi.fn(),
    assets: ["USDC", "XLM", "EURC"],
    onAssetChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onAmountMinChange: vi.fn(),
    onAmountMaxChange: vi.fn(),
    onClearAll: vi.fn(),
    hasActiveFilters: false,
    ...extraProps,
  };
  const view = render(<TransactionFilterPanel {...props} />);
  return { ...view, props };
}

describe("TransactionFilterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search and filter controls", () => {
    renderPanel();

    expect(
      screen.getByRole("searchbox", { name: /Search transactions/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter to date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum transaction amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum transaction amount/i)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Asset/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Filter by Type Deposit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Filter by Status Pending/i }),
    ).toBeInTheDocument();
  });

  it("renders asset options passed via props", () => {
    renderPanel();

    const assetSelect = screen.getByRole("combobox", { name: /Asset/i });
    expect(
      screen.getByRole("option", { name: "All assets" }),
    ).toBeInTheDocument();
    expect(within(assetSelect).getByRole("option", { name: "USDC" })).toBeInTheDocument();
    expect(within(assetSelect).getByRole("option", { name: "XLM" })).toBeInTheDocument();
    expect(within(assetSelect).getByRole("option", { name: "EURC" })).toBeInTheDocument();
  });

  it("calls onAssetChange when a different asset is selected", () => {
    const { props } = renderPanel();

    fireEvent.change(screen.getByRole("combobox", { name: /Asset/i }), {
      target: { value: "XLM" },
    });

    expect(props.onAssetChange).toHaveBeenCalledWith("XLM");
  });

  it("does not show the Clear Filters button when there are no active filters", () => {
    renderPanel({}, { hasActiveFilters: false });

    expect(
      screen.queryByRole("button", { name: /Clear all filters/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking Clear Filters calls onClearAll and resets local state", () => {
    const { props } = renderPanel(
      { search: "abc", amountMin: "10", amountMax: "500" },
      { hasActiveFilters: true },
    );

    const clearBtn = screen.getByRole("button", { name: /Clear all filters/i });
    fireEvent.click(clearBtn);

    expect(props.onClearAll).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByRole("searchbox", {
      name: /Search transactions/i,
    }) as HTMLInputElement;
    expect(searchInput.value).toBe("");
  });

  it("toggles aria-expanded on the expand/collapse button and hides body when collapsed", () => {
    renderPanel();

    const toggleBtn = screen.getByRole("button", { name: /Collapse filters/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: /Filter controls/i })).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("group", { name: /Filter controls/i }),
    ).not.toBeInTheDocument();

    const expandBtn = screen.getByRole("button", { name: /Expand filters/i });
    fireEvent.click(expandBtn);

    expect(expandBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: /Filter controls/i })).toBeInTheDocument();
  });
});
