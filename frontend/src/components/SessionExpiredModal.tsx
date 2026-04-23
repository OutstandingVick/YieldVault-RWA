import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Lock, Wallet, Home } from "lucide-react";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      const firstInteractive = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstInteractive?.focus();
    });

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !modalRef.current) {
      return;
    }

    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return createPortal(
    <div
      className="session-expired-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
    >
      <div
        ref={modalRef}
        className="session-expired-modal glass-panel"
        onKeyDown={handleKeyDown}
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
            marginBottom: "8px",
          }}
        >
          <Lock size={48} />
        </div>

        <div style={{ textAlign: "center" }}>
          <h1
            id="session-expired-title"
            className="text-gradient"
            style={{ fontSize: "1.8rem", marginBottom: "12px" }}
          >
            Session Expired
          </h1>
          <p
            id="session-expired-desc"
            style={{
              color: "var(--text-secondary)",
              fontSize: "1rem",
              lineHeight: "1.6",
              marginBottom: "8px",
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
                marginBottom: "4px",
              }}
            >
              {intendedPath}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            marginTop: "8px",
          }}
        >
          <button
            id="session-expired-reconnect"
            className="btn btn-primary animate-glow"
            onClick={onReconnect}
            style={{ width: "100%", padding: "14px" }}
          >
            <Wallet size={18} />
            Reconnect Wallet
          </button>

          <button
            className="btn btn-outline"
            onClick={onDismiss}
            style={{ width: "100%", padding: "14px" }}
          >
            <Home size={18} />
            Go to Home
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SessionExpiredModal;
