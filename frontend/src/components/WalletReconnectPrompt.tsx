import React from "react";
import { Wallet, X } from "lucide-react";
import { useTranslation } from "../i18n";
import type { WalletProvider } from "../lib/walletSession";

interface WalletReconnectPromptProps {
  provider: WalletProvider;
  onConfirm: () => void;
  onDismiss: () => void;
}

const PROVIDER_LABELS: Record<WalletProvider, string> = {
  freighter: "Freighter",
};

const WalletReconnectPrompt: React.FC<WalletReconnectPromptProps> = ({
  provider,
  onConfirm,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const providerLabel = PROVIDER_LABELS[provider];

  return (
    <div
      role="alert"
      aria-live="polite"
      className="wallet-reconnect-prompt"
      style={{
        position: "fixed",
        top: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: "480px",
        width: "90%",
        background: "var(--surface-secondary)",
        border: "1px solid var(--accent-cyan-dim)",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0, 240, 255, 0.1)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div style={{ color: "var(--accent-cyan)", display: "flex" }}>
        <Wallet size={24} />
      </div>

      <div style={{ flex: 1 }}>
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          {t("reconnect.title")}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.4,
          }}
        >
          {t("reconnect.description").replace("{{provider}}", providerLabel)}
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          style={{ padding: "8px 16px", fontSize: "0.875rem" }}
        >
          {t("reconnect.confirm")}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onDismiss}
          style={{ padding: "8px", borderRadius: "4px", color: "var(--text-secondary)" }}
          aria-label={t("reconnect.dismiss")}
          title={t("reconnect.dismiss")}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default WalletReconnectPrompt;
