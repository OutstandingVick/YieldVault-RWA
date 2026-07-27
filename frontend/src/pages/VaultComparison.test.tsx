import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VaultComparison from "./VaultComparison";

describe("VaultComparison", () => {
  it("renders selected strategies and lets users compare them", () => {
    render(
      <MemoryRouter>
        <VaultComparison />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Compare Vault Strategies/i })).toBeInTheDocument();
    expect(screen.getByText(/Side-by-side comparison/i)).toBeInTheDocument();
    const franklinMatches = screen.getAllByText(/Franklin BENJI Connector/i);
    expect(franklinMatches.length).toBeGreaterThan(0);
    const tokenizedMatches = screen.getAllByText(/Tokenized Treasury Ladder/i);
    expect(tokenizedMatches.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Liquidity Buffer/i }));
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it("shows the empty state when fewer than two strategies are selected", () => {
    render(
      <MemoryRouter>
        <VaultComparison />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tokenized Treasury Ladder/i }));
    fireEvent.click(screen.getByRole("button", { name: /Franklin BENJI Connector/i }));

    expect(screen.getByText(/Select at least two strategies/i)).toBeInTheDocument();
  });
});