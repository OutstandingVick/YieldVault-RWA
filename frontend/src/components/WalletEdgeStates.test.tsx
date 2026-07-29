import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WalletConnect from "./WalletConnect";
import * as freighter from "@stellar/freighter-api";
import { ToastProvider } from "../context/ToastContext";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
}));

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "toast.walletConnected.title": "Wallet connected",
        "toast.walletConnected.description": "Freighter is now connected.",
        "toast.walletPermissionRequired.title": "Wallet permission required",
        "toast.walletConnectionFailed.title": "Wallet connection failed",
        "toast.walletDisconnected.title": "Wallet disconnected",
        "toast.walletDisconnected.description": "Freighter is no longer connected.",
        "wallet.error.notInstalled": "Freighter wallet extension not detected.",
        "wallet.error.notAllowed": "Freighter permission denied.",
        "wallet.error.noAddress": "Unable to retrieve wallet address.",
        "wallet.error.generic": "Connection failed.",
        "wallet.connecting": "Connecting...",
        "wallet.connectFreighter": "Connect Freighter",
        "wallet.disconnectAria": "Disconnect Wallet",
        "wallet.status.connected": "Connected",
        "wallet.status.disconnected": "Not connected",
        "wallet.status.error": "Connection error",
        "reconnect.title": "Welcome back",
        "reconnect.description": "Reconnect with Freighter.",
        "reconnect.confirm": "Reconnect",
        "reconnect.dismiss": "Use a different wallet",
        "common.dismiss": "Dismiss",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockedFreighter = vi.mocked(freighter);

const WalletConnectWrapper: React.FC<ComponentProps<typeof WalletConnect>> = (props) => (
  <ToastProvider>
    <WalletConnect {...props} />
  </ToastProvider>
);

describe("Wallet edge states", () => {
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    mockedFreighter.isConnected.mockResolvedValue({ isConnected: true });
    mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: true });
    mockedFreighter.getAddress.mockResolvedValue({ address: "GABC123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("handles wallet not installed (Freighter throws)", async () => {
    mockedFreighter.setAllowed.mockRejectedValue(new Error("Freighter not found"));

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("Freighter wallet extension not detected.")).toBeInTheDocument();
    });
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it("handles permission denied by user", async () => {
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: false })
      .mockResolvedValue({ isAllowed: false });
    mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: false });

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("Freighter permission denied.")).toBeInTheDocument();
    });
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it("handles no address returned from Freighter", async () => {
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: false })
      .mockResolvedValue({ isAllowed: true });
    mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: true });
    mockedFreighter.getAddress.mockResolvedValue({ address: "" });

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("Unable to retrieve wallet address.")).toBeInTheDocument();
    });
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it("handles rapid disconnect followed by reconnect", async () => {
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: false })
      .mockResolvedValue({ isAllowed: true });

    const { rerender } = render(
      <WalletConnectWrapper
        walletAddress="GABC123"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByLabelText("Disconnect Wallet"));
    expect(mockOnDisconnect).toHaveBeenCalledWith("manual");

    rerender(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: true });
    mockedFreighter.getAddress.mockResolvedValue({ address: "GNEW456" });

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith("GNEW456");
    });
  });

  it("handles wallet polling detecting connection loss", async () => {
    mockedFreighter.isConnected.mockResolvedValue({ isConnected: true });
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: true })
      .mockResolvedValue({ isAllowed: false });

    render(
      <WalletConnectWrapper
        walletAddress="GABC123"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    await waitFor(() => {
      expect(mockOnDisconnect).toHaveBeenCalledWith("connection-lost");
    });
  });

  it("handles Freighter availability flapping during reconnect", async () => {
    mockedFreighter.isConnected
      .mockResolvedValueOnce({ isConnected: true })
      .mockResolvedValueOnce({ isConnected: false })
      .mockResolvedValueOnce({ isConnected: true });

    localStorage.setItem("yieldvault_last_wallet_provider", "freighter");
    sessionStorage.removeItem("yieldvault_wallet_manual_disconnect");

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeInTheDocument();
    });
  });

  it("recovers after connection error and successful retry", async () => {
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: false })
      .mockResolvedValueOnce({ isAllowed: false });
    mockedFreighter.setAllowed
      .mockRejectedValueOnce(new Error("Freighter not found"))
      .mockResolvedValueOnce({ isAllowed: true });

    const { rerender } = render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("Freighter wallet extension not detected.")).toBeInTheDocument();
    });

    mockedFreighter.getAddress.mockResolvedValue({ address: "GRECOVER" });

    rerender(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith("GRECOVER");
    });
  });

  it("shows connecting state during async wallet operation", async () => {
    mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
    mockedFreighter.setAllowed.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200)),
    );

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    expect(screen.getByText("Connecting...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Connecting...")).not.toBeInTheDocument();
    });
  });

  it("clears reconnect prompt dismissed flag on successful connection", async () => {
    mockedFreighter.isAllowed
      .mockResolvedValueOnce({ isAllowed: false })
      .mockResolvedValue({ isAllowed: true });
    mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: true });
    mockedFreighter.getAddress.mockResolvedValue({ address: "GABC123" });
    sessionStorage.setItem("yieldvault_wallet_reconnect_prompt_dismissed", "1");

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalled();
      expect(sessionStorage.getItem("yieldvault_wallet_reconnect_prompt_dismissed")).toBeNull();
    });
  });

  it("displays session expiry disconnect correctly", () => {
    render(
      <WalletConnectWrapper
        walletAddress="GABC123"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    fireEvent.click(screen.getByLabelText("Disconnect Wallet"));
    expect(mockOnDisconnect).toHaveBeenCalledWith("manual");
  });

  it("does not show reconnect prompt when manual disconnect is active", () => {
    localStorage.setItem("yieldvault_last_wallet_provider", "freighter");
    sessionStorage.setItem("yieldvault_wallet_manual_disconnect", "1");

    render(
      <WalletConnectWrapper
        walletAddress={null}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows error state when Freighter returns disconnected during polling", async () => {
    mockedFreighter.isConnected.mockResolvedValue({ isConnected: false });

    render(
      <WalletConnectWrapper
        walletAddress="GABC123"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />,
    );

    await waitFor(() => {
      expect(mockOnDisconnect).toHaveBeenCalledWith("connection-lost");
    });
  });
});
