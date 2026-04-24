import React from "react";
import { Lock, Wallet, Home } from "lucide-react";
import { Modal } from "./Modal";

interface SessionExpiredModalProps {
  intendedPath: string;
  onReconnect: () => void;
  onDismiss: () => void;
}

const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  intendedPath,
  onReconnect,
  onDismiss,
}) => {
  return (
    <Modal
      isOpen={true}
      onClose={onDismiss}
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "var(--bg-error)",
            color: "var(--text-error)",
            padding: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <Lock size={48} />
        </div>

        <h1
          id="session-expired-title"
          className="text-gradient"
          style={{ fontSize: "1.8rem", marginBottom: "12px", marginTop: 0 }}
        >
          Session Expired
        </h1>
        <p
          id="session-expired-desc"
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: "1.6",
            marginBottom: "16px",
            marginTop: 0,
          }}
        >
          Your wallet session is no longer authorised. Please reconnect
          Freighter to continue where you left off.
        </p>
        {intendedPath && intendedPath !== "/" && (
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "0.875rem",
              fontFamily: "monospace",
              background: "var(--bg-muted)",
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "16px",
            }}
          >
            {intendedPath}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
          }}
        >
          <button
            id="session-expired-reconnect"
            className="btn btn-primary animate-glow"
            onClick={onReconnect}
            style={{ width: "100%", padding: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Wallet size={18} />
            Reconnect Wallet
          </button>

          <button
            className="btn btn-outline"
            onClick={onDismiss}
            style={{ width: "100%", padding: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Home size={18} />
            Go to Home
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
