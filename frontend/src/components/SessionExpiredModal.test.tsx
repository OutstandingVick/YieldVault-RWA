import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SessionExpiredModal from "./SessionExpiredModal";

describe("SessionExpiredModal", () => {
  it("renders the session expired heading", () => {
    render(
      <SessionExpiredModal
        intendedPath="/portfolio"
        onReconnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Session Expired")).toBeInTheDocument();
  });

  it("displays the intended path when it is not root", () => {
    render(
      <SessionExpiredModal
        intendedPath="/analytics"
        onReconnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("/analytics")).toBeInTheDocument();
  });

  it("does not display path badge when path is root", () => {
    render(
      <SessionExpiredModal
        intendedPath="/"
        onReconnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // The path badge should not be rendered for "/"
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("calls onReconnect when Reconnect Wallet button is clicked", () => {
    const onReconnect = vi.fn();

    render(
      <SessionExpiredModal
        intendedPath="/portfolio"
        onReconnect={onReconnect}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reconnect wallet/i }));
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Go to Home button is clicked", () => {
    const onDismiss = vi.fn();

    render(
      <SessionExpiredModal
        intendedPath="/portfolio"
        onReconnect={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /go to home/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA role and labels for accessibility", () => {
    render(
      <SessionExpiredModal
        intendedPath="/"
        onReconnect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "session-expired-title");
    expect(dialog).toHaveAttribute("aria-describedby", "session-expired-desc");
  });
});
