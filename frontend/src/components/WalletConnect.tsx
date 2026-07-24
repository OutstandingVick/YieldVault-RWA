import React, { useEffect, useReducer, useRef } from "react";
import { setAllowed } from "@stellar/freighter-api";
import { AlertCircle, Loader2, LogOut, Wallet, X } from "./icons";
import { hasCustomRpcConfig, networkConfig } from "../config/network";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "../i18n";
import CopyButton from "./CopyButton";
import { discoverConnectedAddress } from "../lib/stellarAccount";
import {
  classifyWalletConnectionError,
  createWalletConnectionError,
  initialWalletConnectionState,
  reduceWalletConnection,
  walletErrorI18nKeys,
} from "../lib/walletConnectionState";

interface WalletConnectProps {
  walletAddress: string | null;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

const POLL_INTERVAL_MS = 10_000;

const WalletConnect: React.FC<WalletConnectProps> = ({
  walletAddress,
  onConnect,
  onDisconnect,
}) => {
  const [connection, dispatch] = useReducer(
    reduceWalletConnection,
    initialWalletConnectionState,
  );
  const toast = useToast();
  const { t } = useTranslation();
  const walletAddressRef = useRef(walletAddress);
  walletAddressRef.current = walletAddress;

  // Keep machine aligned with the controlled address from the parent.
  useEffect(() => {
    if (walletAddress) {
      dispatch({ type: "ADDRESS_SYNCED", address: walletAddress });
      return;
    }

    // Preserve typed error after Freighter drops the session; otherwise reset.
    dispatch({ type: "PARENT_ADDRESS_CLEARED" });
  }, [walletAddress]);

  useEffect(() => {
    let mounted = true;

    const syncConnection = async () => {
      const discoveredAddress = await discoverConnectedAddress();
      if (!mounted) return;

      if (discoveredAddress) {
        onConnect(discoveredAddress);
        return;
      }

      if (walletAddressRef.current) {
        dispatch({ type: "EXTERNAL_DISCONNECT" });
        onDisconnect();
        toast.info({
          title: t("toast.walletDisconnectedExternal.title"),
          description: t("toast.walletDisconnectedExternal.description"),
        });
      }
    };

    syncConnection();
    const interval = window.setInterval(syncConnection, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [onConnect, onDisconnect, toast, t]);

  const handleConnect = async () => {
    dispatch({ type: "CONNECT_REQUESTED" });
    try {
      await setAllowed();
      const discoveredAddress = await discoverConnectedAddress();
      if (discoveredAddress) {
        dispatch({
          type: "CONNECT_SUCCEEDED",
          address: discoveredAddress,
        });
        onConnect(discoveredAddress);
        toast.success({
          title: t("toast.walletConnected.title"),
          description: t("toast.walletConnected.description"),
        });
        return;
      }

      const error = createWalletConnectionError(
        "NO_ADDRESS",
        "Freighter did not return a public key for this session.",
        true,
      );
      dispatch({ type: "CONNECT_FAILED", error });
      toast.warning({
        title: t("toast.walletPermissionRequired.title"),
        description: t("toast.walletPermissionRequired.description"),
      });
    } catch (e: unknown) {
      console.error(e);
      const error = classifyWalletConnectionError(e);
      dispatch({ type: "CONNECT_FAILED", error });
      const keys = walletErrorI18nKeys(error.code);
      toast.error({
        title: t(keys.title),
        description: t(keys.description),
      });
    }
  };

  const handleRetry = () => {
    void handleConnect();
  };

  const handleDismissError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`;
  };

  const isConnecting = connection.status === "connecting";
  const showError =
    connection.status === "error" && connection.error !== null;

  if (walletAddress) {
    return (
      <div className="wallet-status flex items-center gap-md">
        <div
          className="glass-panel"
          style={{
            padding: "8px 16px",
            borderRadius: "99px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "1px solid var(--accent-cyan-dim)",
            boxShadow: "0 0 10px rgba(0,240,255,0.1)",
          }}
          data-wallet-status="connected"
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-cyan)",
              boxShadow: "0 0 8px var(--accent-cyan)",
            }}
          />
          <div className="copy-field">
            <span
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              title={walletAddress}
            >
              {formatAddress(walletAddress)}
            </span>
            <CopyButton
              value={walletAddress}
              label="wallet address"
              successDescription="The full wallet address has been copied to your clipboard."
            />
          </div>
        </div>
        <div
          className="glass-panel"
          style={{
            padding: "8px 12px",
            borderRadius: "10px",
            border: "1px solid var(--border-glass)",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            maxWidth: "260px",
          }}
          title={networkConfig.rpcUrl}
        >
          {t("wallet.rpcPrefix")}{" "}
          {hasCustomRpcConfig ? t("wallet.rpcCustom") : t("wallet.rpcDefault")}
        </div>
        <button
          className="btn btn-outline"
          style={{ padding: "8px", borderRadius: "50%" }}
          onClick={() => {
            dispatch({ type: "DISCONNECT_REQUESTED" });
            onDisconnect();
            toast.info({
              title: t("toast.walletDisconnected.title"),
              description: t("toast.walletDisconnected.description"),
            });
          }}
          aria-label={t("wallet.disconnectAria")}
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
      }}
      data-wallet-status={connection.status}
    >
      <button
        className="btn btn-primary animate-glow"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <Loader2
            size={18}
            className="spin"
            style={{ animation: "spin 1s linear infinite" }}
          />
        ) : (
          <Wallet size={18} />
        )}
        {isConnecting ? t("wallet.connecting") : t("wallet.connectFreighter")}
      </button>

      {showError && connection.error ? (
        <div
          className="glass-panel wallet-connection-error"
          role="alert"
          aria-live="assertive"
          data-error-code={connection.error.code}
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid var(--text-error, #f87171)",
            maxWidth: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <AlertCircle
              size={16}
              style={{ color: "var(--text-error, #f87171)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "2px",
                }}
              >
                {t(walletErrorI18nKeys(connection.error.code).title)}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {t(walletErrorI18nKeys(connection.error.code).description)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "2px", borderRadius: "50%", flexShrink: 0 }}
              onClick={handleDismissError}
              aria-label={t("wallet.errors.dismissAria")}
            >
              <X size={14} />
            </button>
          </div>
          {connection.error.retryable ? (
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              onClick={handleRetry}
              disabled={isConnecting}
            >
              {t("wallet.errors.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default WalletConnect;
