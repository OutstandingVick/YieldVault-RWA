import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RiskSummaryCard, { type RiskAction } from "./RiskSummaryCard";

const baseLabels = {
  title: "Account Risk Summary",
  subtitle: "Warnings are prioritized by what you can do next.",
  allClearLabel: "All clear",
  healthyMessage: "Your wallet is in a healthy operating window.",
};

function buildItems(overrides: Partial<RiskAction>[] = [{}]): RiskAction[] {
  return overrides.map((override, index) => ({
    id: `item-${index}`,
    title: `Warning ${index + 1}`,
    description: `Description ${index + 1}`,
    label: `Action ${index + 1}`,
    tone: "warning",
    onClick: vi.fn(),
    ...override,
  }));
}

describe("RiskSummaryCard", () => {
  it("renders warnings with title, description, and fires CTA click handlers", () => {
    const onWalletClick = vi.fn();
    const onCapClick = vi.fn();
    const items = buildItems([
      { id: "wallet", title: "Connect your wallet", label: "Connect wallet", tone: "info", onClick: onWalletClick },
      { id: "cap-reached", title: "Vault capacity reached", label: "Compare vaults", tone: "critical", onClick: onCapClick },
    ]);

    render(
      <RiskSummaryCard
        items={items}
        {...baseLabels}
        warningsLabel="2 warnings"
      />,
    );

    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
    expect(screen.getByText("Vault capacity reached")).toBeInTheDocument();
    expect(screen.getByText("Description 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(onWalletClick).toHaveBeenCalledTimes(1);
    expect(onCapClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Compare vaults" }));
    expect(onCapClick).toHaveBeenCalledTimes(1);
  });

  it("is exposed as a labelled region", () => {
    render(
      <RiskSummaryCard
        items={buildItems()}
        {...baseLabels}
        warningsLabel="1 warning"
      />,
    );

    expect(
      screen.getByRole("region", { name: /Account Risk Summary/i }),
    ).toBeInTheDocument();
  });

  it("renders the all-clear state with a healthy CTA that fires on click", () => {
    const onHealthyClick = vi.fn();

    render(
      <RiskSummaryCard
        items={[]}
        {...baseLabels}
        warningsLabel="0 warnings"
        healthyAction={{ label: "Compare strategies", onClick: onHealthyClick }}
      />,
    );

    expect(screen.getByText("All clear")).toBeInTheDocument();
    expect(
      screen.getByText("Your wallet is in a healthy operating window."),
    ).toBeInTheDocument();

    const healthyButton = screen.getByRole("button", { name: "Compare strategies" });
    fireEvent.click(healthyButton);
    expect(onHealthyClick).toHaveBeenCalledTimes(1);
  });

  it("omits the healthy CTA button when no healthyAction is provided", () => {
    render(
      <RiskSummaryCard
        items={[]}
        {...baseLabels}
        warningsLabel="0 warnings"
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Your wallet is in a healthy operating window."),
    ).toBeInTheDocument();
  });

  it("shows the singular badge label for one warning", () => {
    render(
      <RiskSummaryCard
        items={buildItems([{}])}
        {...baseLabels}
        warningsLabel="1 warning"
      />,
    );

    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.queryByText("All clear")).not.toBeInTheDocument();
  });

  it("shows the plural badge label for multiple warnings", () => {
    render(
      <RiskSummaryCard
        items={buildItems([{}, {}, {}])}
        {...baseLabels}
        warningsLabel="3 warnings"
      />,
    );

    expect(screen.getByText("3 warnings")).toBeInTheDocument();
  });
});
