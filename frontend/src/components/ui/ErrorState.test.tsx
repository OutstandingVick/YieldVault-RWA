import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("renders default title, description, and alert role", () => {
    render(<ErrorState />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("An error occurred while loading this section. Please try again.")
    ).toBeInTheDocument();
  });

  it("renders retry button and fires callback on click", () => {
    const handleRetry = vi.fn();
    render(<ErrorState onRetry={handleRetry} retryLabel="Reload Vault" />);
    const retryBtn = screen.getByRole("button", { name: /reload vault/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders warning tone and custom title/description", () => {
    const { container } = render(
      <ErrorState
        tone="warning"
        title="High Network Congestion"
        description="Transactions may experience delay."
      />
    );
    expect(container.firstChild).toHaveClass("error-state-tone-warning");
    expect(screen.getByText("High Network Congestion")).toBeInTheDocument();
    expect(screen.getByText("Transactions may experience delay.")).toBeInTheDocument();
  });

  it("toggles technical error details when enabled", () => {
    const customError = new Error("Connection timed out after 5000ms");
    render(
      <ErrorState
        error={customError}
        showDetailsToggle={true}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /show technical details/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByTestId("error-state-detail")).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("error-state-detail")).toHaveTextContent(
      "Connection timed out after 5000ms"
    );

    fireEvent.click(screen.getByRole("button", { name: /hide technical details/i }));
    expect(screen.queryByTestId("error-state-detail")).not.toBeInTheDocument();
  });
});
