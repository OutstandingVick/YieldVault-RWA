import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WalletDisconnectRecoveryModal from "./WalletDisconnectRecoveryModal";
import type { VaultFormDraft } from "../lib/formDraftStorage";

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "walletRecovery.title": "Wallet Disconnected",
        "walletRecovery.description": "Your wallet disconnected unexpectedly.",
        "walletRecovery.draftLabel": "Saved draft",
        "walletRecovery.noAmount": "No amount entered",
        "walletRecovery.reconnect": "Reconnect Wallet",
        "walletRecovery.restore": "Restore Draft",
        "walletRecovery.discard": "Discard Draft",
      "walletRecovery.tab.deposit": "Deposit",
      "walletRecovery.tab.withdraw": "Withdrawal",
        "common.dismiss": "Dismiss",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("./Modal", () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean; onClose?: () => void }) =>
    isOpen ? <div role="dialog" aria-modal="true">{children}</div> : null,
}));

function makeDraft(overrides: Partial<VaultFormDraft> = {}): VaultFormDraft {
  return {
    tab: "deposit" as const,
    step: "amount" as const,
    amount: "100",
    ...overrides,
  };
}

describe("WalletDisconnectRecoveryModal", () => {
  const onReconnect = vi.fn();
  const onRestore = vi.fn();
  const onDiscard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with draft info", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft()}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("Wallet Disconnected")).toBeInTheDocument();
    expect(screen.getByText("Saved draft")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
  });

  it("shows no amount when draft has no amount", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft({ amount: "" })}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("No amount entered")).toBeInTheDocument();
  });

  it("calls onReconnect when Reconnect Wallet is clicked", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft()}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reconnect wallet/i }));
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("calls onRestore when Restore Draft is clicked", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft()}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /restore draft/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when Discard Draft is clicked", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft()}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("shows withdrawal tab label for withdrawal drafts", () => {
    render(
      <WalletDisconnectRecoveryModal
        draft={makeDraft({ tab: "withdraw" })}
        onReconnect={onReconnect}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("Withdrawal")).toBeInTheDocument();
  });
});
