import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import WalletReconnectPrompt from "./WalletReconnectPrompt";

describe("WalletReconnectPrompt", () => {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();

  const renderPrompt = () =>
    render(
      <WalletReconnectPrompt
        provider="freighter"
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

  it("renders the title and provider name", () => {
    renderPrompt();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText(/Freighter/)).toBeInTheDocument();
  });

  it("calls onConfirm when Reconnect button is clicked", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reconnect"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    renderPrompt();
    fireEvent.click(screen.getByRole("button", { name: /use a different wallet/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has role=alert for accessibility", () => {
    renderPrompt();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
