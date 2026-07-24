import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartWidgetPlaceholder } from "./ChartWidgetPlaceholder";

describe("ChartWidgetPlaceholder", () => {
  it("renders deterministic empty placeholder content", () => {
    render(
      <ChartWidgetPlaceholder
        variant="empty"
        title="No chart data"
        description="Data will appear here soon."
        data-testid="chart-empty"
      />,
    );

    expect(screen.getByTestId("chart-empty")).toBeInTheDocument();
    expect(screen.getByText("No chart data")).toBeInTheDocument();
    expect(screen.getByText("Data will appear here soon.")).toBeInTheDocument();
  });

  it("renders error placeholder with retry action", () => {
    const onRetry = vi.fn();
    render(
      <ChartWidgetPlaceholder
        variant="error"
        title="Failed to load chart"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
