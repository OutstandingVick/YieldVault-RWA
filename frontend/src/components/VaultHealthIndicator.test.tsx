import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VaultHealthIndicator from "./VaultHealthIndicator";

describe("VaultHealthIndicator", () => {
  it("renders a healthy status indicator with accessible label", () => {
    render(
      <VaultHealthIndicator
        status="healthy"
        vaultName="Stellar RWA Yield Fund"
        message="All systems operational"
      />,
    );

    expect(
      screen.getByRole("status", {
        name: /Stellar RWA Yield Fund: Healthy\. All systems operational/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders degraded and unhealthy statuses", () => {
    const { rerender } = render(
      <VaultHealthIndicator status="degraded" message="Elevated latency" />,
    );
    expect(screen.getByRole("status", { name: /Degraded/i })).toBeInTheDocument();

    rerender(<VaultHealthIndicator status="unhealthy" message="Oracle down" />);
    expect(screen.getByRole("status", { name: /Unhealthy/i })).toBeInTheDocument();
  });

  it("shows a tooltip on hover", () => {
    render(
      <VaultHealthIndicator
        status="degraded"
        vaultName="Liquidity Ladder"
        message="Elevated settlement latency"
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("status"));

    expect(screen.getByRole("tooltip")).toHaveTextContent(/Liquidity Ladder/);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Elevated settlement latency/);
  });

  it("applies compact class when compact is true", () => {
    const { container } = render(
      <VaultHealthIndicator status="healthy" compact />,
    );

    expect(container.firstChild).toHaveClass("vault-health-indicator--compact");
  });
});
