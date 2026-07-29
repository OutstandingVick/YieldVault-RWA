import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import StateWrapper from "./StateWrapper";

describe("StateWrapper", () => {
  it("renders children when no loading, error, or empty states are active", () => {
    render(
      <StateWrapper>
        <div data-testid="content">Dashboard Content</div>
      </StateWrapper>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders LoadingState when isLoading is true", () => {
    render(
      <StateWrapper isLoading={true} loadingMessage="Loading vault metrics...">
        <div>Dashboard Content</div>
      </StateWrapper>
    );
    expect(screen.getByText("Loading vault metrics...")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("renders ErrorState when isError is true", () => {
    const handleRetry = vi.fn();
    render(
      <StateWrapper
        isError={true}
        error={new Error("Failed to connect")}
        onRetry={handleRetry}
      >
        <div>Dashboard Content</div>
      </StateWrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState when isEmpty is true", () => {
    render(
      <StateWrapper
        isEmpty={true}
        emptyProps={{ title: "No Transactions Found", kind: "no-data" }}
      >
        <div>Dashboard Content</div>
      </StateWrapper>
    );
    expect(screen.getByText("No Transactions Found")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("prioritizes isLoading over isError and isEmpty", () => {
    render(
      <StateWrapper isLoading={true} isError={true} isEmpty={true}>
        <div>Content</div>
      </StateWrapper>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prioritizes isError over isEmpty", () => {
    render(
      <StateWrapper isError={true} isEmpty={true}>
        <div>Content</div>
      </StateWrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
