import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TransactionSortControl from "./TransactionSortControl";
import type { SortKey } from "../lib/transactionQuery";

function renderControl(sortKeys: SortKey[] = [], overrides = {}) {
  const props = {
    sortKeys,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onDirectionChange: vi.fn(),
    onMove: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  const view = render(<TransactionSortControl {...props} />);
  return { ...view, props };
}

describe("TransactionSortControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("states the default ordering when no sort is configured", () => {
    renderControl([]);

    expect(screen.getByText(/Sorted by date, newest first/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("hides the reset control while the table is on its default ordering", () => {
    renderControl([]);

    expect(
      screen.queryByRole("button", { name: /Reset to the default sort order/i }),
    ).not.toBeInTheDocument();
  });

  it("lists the active sort keys in priority order", () => {
    renderControl([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Status");
    expect(items[1]).toHaveTextContent("Amount");
  });

  it("names each key's direction in words, not only as an arrow", () => {
    renderControl([{ field: "amount", direction: "desc" }]);

    expect(
      screen.getByRole("button", { name: /Amount: Descending/i }),
    ).toBeInTheDocument();
  });

  it("flips a key's direction to the opposite of its current one", () => {
    const { props } = renderControl([{ field: "amount", direction: "desc" }]);

    fireEvent.click(screen.getByRole("button", { name: /Amount: Descending/i }));

    expect(props.onDirectionChange).toHaveBeenCalledWith("amount", "asc");
  });

  it("removes a key", () => {
    const { props } = renderControl([{ field: "status", direction: "asc" }]);

    fireEvent.click(
      screen.getByRole("button", { name: /Stop sorting by Status/i }),
    );

    expect(props.onRemove).toHaveBeenCalledWith("status");
  });

  it("reorders priority", () => {
    const { props } = renderControl([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: /Increase sort priority of Amount/i }),
    );
    expect(props.onMove).toHaveBeenCalledWith("amount", -1);

    fireEvent.click(
      screen.getByRole("button", { name: /Decrease sort priority of Status/i }),
    );
    expect(props.onMove).toHaveBeenCalledWith("status", 1);
  });

  it("disables the moves that would fall off either end", () => {
    renderControl([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);

    expect(
      screen.getByRole("button", { name: /Increase sort priority of Status/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Decrease sort priority of Amount/i }),
    ).toBeDisabled();
  });

  it("offers only the columns that are not already sorted", () => {
    renderControl([{ field: "amount", direction: "desc" }]);

    const select = screen.getByRole("combobox", { name: /Add a tiebreaker/i });
    expect(select).toBeEnabled();
    expect(screen.getByRole("option", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Status" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Amount" })).not.toBeInTheDocument();
  });

  it("adds the chosen column", () => {
    const { props } = renderControl([{ field: "amount", direction: "desc" }]);

    fireEvent.change(screen.getByRole("combobox", { name: /Add a tiebreaker/i }), {
      target: { value: "status" },
    });

    expect(props.onAdd).toHaveBeenCalledWith("status");
  });

  it("says why no more columns can be added once the cap is reached", () => {
    renderControl([
      { field: "date", direction: "desc" },
      { field: "amount", direction: "desc" },
      { field: "type", direction: "asc" },
    ]);

    const select = screen.getByRole("combobox", { name: /Add a tiebreaker/i });
    expect(select).toBeDisabled();
    expect(screen.getByText(/Maximum of 3 columns/i)).toBeInTheDocument();
  });

  it("clears the whole sort", () => {
    const { props } = renderControl([{ field: "amount", direction: "desc" }]);

    fireEvent.click(
      screen.getByRole("button", { name: /Reset to the default sort order/i }),
    );

    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("documents the shift-click shortcut", () => {
    renderControl([]);

    expect(screen.getByText(/Shift-click a column header/i)).toBeInTheDocument();
  });
});
