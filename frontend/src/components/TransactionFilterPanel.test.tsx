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

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

describe("TransactionFilterPanel — date presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the relative range shortcuts", () => {
    renderPanel({}, { onDatePreset: vi.fn() });

    const group = screen.getByRole("group", { name: /Date range presets/i });
    expect(
      within(group).getByRole("button", { name: "Last 7 days" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Last 30 days" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Last 90 days" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Year to date" }),
    ).toBeInTheDocument();
  });

  it("omits the preset row when the page does not supply a handler", () => {
    renderPanel();

    expect(
      screen.queryByRole("group", { name: /Date range presets/i }),
    ).not.toBeInTheDocument();
  });

  it("reports the chosen preset", () => {
    const onDatePreset = vi.fn();
    renderPanel({}, { onDatePreset });

    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    expect(onDatePreset).toHaveBeenCalledWith("30d");
  });

  it("marks the preset the current range matches as pressed", () => {
    renderPanel({}, { onDatePreset: vi.fn(), activeDatePreset: "90d" });

    expect(screen.getByRole("button", { name: "Last 90 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("offers to clear the dates only once a range is set", () => {
    renderPanel({}, { onDatePreset: vi.fn(), onClearDateRange: vi.fn() });
    expect(
      screen.queryByRole("button", { name: /Clear dates/i }),
    ).not.toBeInTheDocument();

    const onClearDateRange = vi.fn();
    renderPanel(
      { dateFrom: "2026-01-01" },
      { onDatePreset: vi.fn(), onClearDateRange },
    );
    fireEvent.click(screen.getByRole("button", { name: /Clear dates/i }));
    expect(onClearDateRange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Range validation
// ---------------------------------------------------------------------------

describe("TransactionFilterPanel — contradictory ranges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains an inverted date range and marks both inputs invalid", () => {
    renderPanel(
      { dateFrom: "2026-06-01", dateTo: "2026-01-01" },
      { issues: [{ range: "date", code: "dateRangeInverted" }] },
    );

    const message = screen.getByText(/from date is after the to date/i);
    expect(message).toBeInTheDocument();

    const from = screen.getByLabelText(/Filter from date/i);
    const to = screen.getByLabelText(/Filter to date/i);
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(to).toHaveAttribute("aria-invalid", "true");
    // The message is announced, and reachable from either input.
    expect(from).toHaveAttribute("aria-describedby", message.id);
    expect(to).toHaveAttribute("aria-describedby", message.id);
  });

  it("explains an inverted amount range and marks both inputs invalid", () => {
    renderPanel(
      { amountMin: "500", amountMax: "10" },
      { issues: [{ range: "amount", code: "amountRangeInverted" }] },
    );

    const message = screen.getByText(/minimum amount is above the maximum/i);
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum transaction amount/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/Maximum transaction amount/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("says nothing and marks nothing invalid for a coherent range", () => {
    renderPanel({ dateFrom: "2026-01-01", dateTo: "2026-06-01" });

    expect(
      screen.queryByText(/from date is after the to date/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Filter from date/i)).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("leaves the date inputs unbounded so either end can be moved past the other", () => {
    // Bounding each input by the other blocks a range from being shifted and
    // gives no explanation; the inline message above covers that case instead.
    renderPanel({ dateFrom: "2026-03-01", dateTo: "2026-04-01" });

    expect(screen.getByLabelText(/Filter from date/i)).not.toHaveAttribute("max");
    expect(screen.getByLabelText(/Filter to date/i)).not.toHaveAttribute("min");
  });
});

// ---------------------------------------------------------------------------
// Active filter chips
// ---------------------------------------------------------------------------

describe("TransactionFilterPanel — active filter chips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the chips visible while the panel is collapsed", () => {
    renderPanel(
      { asset: "USDC" },
      {
        hasActiveFilters: true,
        onRemoveFilter: vi.fn(),
        activeFilterChips: [{ id: "asset", kind: "asset", value: "USDC" }],
      },
    );

    fireEvent.click(screen.getByRole("button", { name: /Collapse filters/i }));

    expect(
      screen.queryByRole("group", { name: /Filter controls/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Asset: USDC")).toBeInTheDocument();
  });

  it("forwards a chip removal", () => {
    const onRemoveFilter = vi.fn();
    const chip = { id: "asset", kind: "asset" as const, value: "USDC" };
    renderPanel(
      { asset: "USDC" },
      { hasActiveFilters: true, onRemoveFilter, activeFilterChips: [chip] },
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Asset: USDC, remove this filter/i }),
    );

    expect(onRemoveFilter).toHaveBeenCalledWith(chip);
  });
});
