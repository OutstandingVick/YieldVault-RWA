import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import VaultComparison from "./VaultComparison";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderComparison(initialEntries: string[] = ["/compare"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/compare" element={<VaultComparison />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VaultComparison", () => {
  it("renders selected strategies and lets users compare them", () => {
    renderComparison();

    expect(screen.getByRole("heading", { name: /Compare Vault Strategies/i })).toBeInTheDocument();
    expect(screen.getByText(/Side-by-side comparison/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Franklin BENJI Connector/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tokenized Treasury Ladder/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Liquidity Buffer/i }));
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it("shows the empty state when fewer than two strategies are selected", () => {
    renderComparison();

    fireEvent.click(screen.getByRole("button", { name: /Tokenized Treasury Ladder/i }));
    fireEvent.click(screen.getByRole("button", { name: /Franklin BENJI Connector/i }));

    expect(screen.getByText(/Select at least two strategies/i)).toBeInTheDocument();
  });

  it("does not add a fourth strategy once the max selection is reached", () => {
    renderComparison();

    fireEvent.click(screen.getByRole("button", { name: /Private Credit Income/i }));
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();

    const fourthCard = screen.getByRole("button", { name: /Liquidity Buffer/i });
    expect(fourthCard).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(fourthCard);

    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    expect(fourthCard).toHaveAttribute("aria-pressed", "false");
  });

  it("navigates to the deposit tab when allocating to selected strategies", () => {
    renderComparison();

    fireEvent.click(screen.getByRole("button", { name: /Allocate to selected/i }));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/?tab=deposit");
  });

  it("restores the selection from the strategies URL param", () => {
    renderComparison(["/compare?strategies=benji,credit-income"]);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Franklin BENJI Connector/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Private Credit Income/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Tokenized Treasury Ladder/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Liquidity Buffer/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("highlights the best APY cell in the comparison table", () => {
    renderComparison(["/compare?strategies=benji,credit-income"]);

    const bestCell = screen.getByRole("table").querySelector('td[data-best="true"]');
    expect(bestCell).not.toBeNull();
    expect(bestCell).toHaveTextContent("9.15%");
  });
});
