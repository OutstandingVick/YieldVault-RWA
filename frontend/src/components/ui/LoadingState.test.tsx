import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import LoadingState from "./LoadingState";

describe("LoadingState", () => {
  it("renders with default loading message and status role", () => {
    render(<LoadingState />);
    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(statusElement).toHaveAttribute("aria-busy", "true");
  });

  it("renders custom message when provided", () => {
    render(<LoadingState message="Fetching vault balance..." />);
    expect(screen.getByText("Fetching vault balance...")).toBeInTheDocument();
  });

  it("applies size class correctly", () => {
    const { container } = render(<LoadingState size="lg" />);
    expect(container.firstChild).toHaveClass("loading-state-lg");
  });

  it("renders custom fallback when provided", () => {
    render(<LoadingState customFallback={<div data-testid="custom-skeleton">Skeleton</div>} />);
    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});
