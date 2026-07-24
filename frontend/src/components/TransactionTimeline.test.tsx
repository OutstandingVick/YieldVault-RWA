import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TransactionTimeline from "./TransactionTimeline";

describe("TransactionTimeline", () => {
  it("renders aria label", () => {
    render(<TransactionTimeline status="pending" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows Submitted step as active when pending", () => {
    render(<TransactionTimeline status="pending" elapsedSeconds={5} />);
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    // elapsed seconds shown next to active step
    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("shows Confirming step as active when confirming", () => {
    render(<TransactionTimeline status="confirming" elapsedSeconds={12} />);
    expect(screen.getByText("Confirming")).toBeInTheDocument();
    expect(screen.getByText("12s")).toBeInTheDocument();
  });

  it("shows Finalized step and explorer link when finalized", () => {
    render(
      <TransactionTimeline
        status="finalized"
        txHash="abc123"
      />,
    );
    // Two "Finalized" labels: one in the steps list (completed) and one in the final row
    const finalizedLabels = screen.getAllByText("Finalized");
    expect(finalizedLabels.length).toBeGreaterThanOrEqual(1);

    const explorerLink = screen.getByRole("link", { name: /View on Stellar Explorer/i });
    expect(explorerLink).toHaveAttribute("href", expect.stringContaining("abc123"));
    expect(explorerLink).toHaveAttribute("target", "_blank");
    expect(explorerLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render explorer link when finalized without txHash", () => {
    render(<TransactionTimeline status="finalized" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows Failed step with default error description", () => {
    render(<TransactionTimeline status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(
      screen.getByText("Transaction was not accepted by the network."),
    ).toBeInTheDocument();
  });

  it("shows custom errorMessage when failed", () => {
    render(
      <TransactionTimeline
        status="failed"
        errorMessage="Transaction timed out."
      />,
    );
    const matches = screen.getAllByText("Transaction timed out.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show elapsed seconds when not provided", () => {
    render(<TransactionTimeline status="pending" />);
    // No "Xs" elapsed time text
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
  });

  it("marks Submitted as completed when status is confirming", () => {
    const { container } = render(<TransactionTimeline status="confirming" />);
    // The Submitted step dot should use the green completed color
    const dots = container.querySelectorAll('[style*="border"]');
    // At least one dot should have the green accent color
    const greenDot = Array.from(dots).find((el) =>
      (el as HTMLElement).style.borderColor?.includes("var(--accent-green)") ||
      (el as HTMLElement).getAttribute("style")?.includes("var(--accent-green)"),
    );
    expect(greenDot).toBeTruthy();
  });
});
