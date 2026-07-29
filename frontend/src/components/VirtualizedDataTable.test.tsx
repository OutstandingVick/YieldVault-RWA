import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  VirtualizedDataTable,
  shouldVirtualizeTransactionList,
  VIRTUALIZATION_THRESHOLD,
} from "./VirtualizedDataTable";
import type { DataTableColumn } from "./DataTable";

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Row ${i + 1}`,
  }));
}

describe("shouldVirtualizeTransactionList", () => {
  it("returns false below the threshold", () => {
    expect(shouldVirtualizeTransactionList(VIRTUALIZATION_THRESHOLD - 1)).toBe(
      false,
    );
  });

  it("returns true at or above the threshold", () => {
    expect(shouldVirtualizeTransactionList(VIRTUALIZATION_THRESHOLD)).toBe(true);
    expect(shouldVirtualizeTransactionList(200)).toBe(true);
  });
});

describe("VirtualizedDataTable", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      value: 400,
    });
  });

  it("renders only a subset of rows in the scroll container", () => {
    render(
      <VirtualizedDataTable
        columns={columns}
        rows={makeRows(120)}
        rowKey={(row) => row.id}
        caption="Test table"
        emptyMessage="No rows"
        maxHeight={200}
      />,
    );

    expect(screen.getByTestId("virtualized-table-body")).toBeInTheDocument();
    const renderedRows = screen.getAllByRole("row").filter((row) =>
      row.classList.contains("data-table-row"),
    );
    expect(renderedRows.length).toBeLessThan(120);
    expect(screen.getByText("Row 1")).toBeInTheDocument();
  });

  it("shows empty message when there are no rows", () => {
    render(
      <VirtualizedDataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        caption="Test table"
        emptyMessage="Nothing here"
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
