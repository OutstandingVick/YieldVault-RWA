import React from "react";
import { RefreshCw, Home, AlertOctagon } from "lucide-react";
import { goHome, reloadPage } from "./errorNavigation";
import { useTranslation } from "../i18n";

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  onReload?: () => void;
  onGoHome?: () => void;
  /** When true, show a sanitized one-line detail (dev only by default). */
  showErrorDetail?: boolean;
}

function isSafeUserFacingDetail(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 160) return false;
  // Block stack-like / path / secret-looking content
  if (/[/\\]|\.tsx?\b|\.jsx?\b|at\s+\S+|Error:|TypeError|ReferenceError|http/i.test(trimmed)) {
    return false;
  }
  return true;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  onReload = reloadPage,
  onGoHome = goHome,
  showErrorDetail = import.meta.env.DEV,
}) => {
  const { t } = useTranslation();
  const detail =
    showErrorDetail && error?.message && isSafeUserFacingDetail(error.message)
      ? error.message
      : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "36px 32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
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
            marginBottom: "8px",
          }}
        >
          <AlertOctagon size={48} aria-hidden="true" />
        </div>

        <div>
          <h1
            className="text-gradient"
            style={{ fontSize: "2rem", marginBottom: "8px" }}
          >
            {t("errorFallback.title")}
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.05rem",
              marginBottom: "20px",
              lineHeight: "1.5",
            }}
          >
            {t("errorFallback.message")}
          </p>
          {detail && (
            <div
              data-testid="error-fallback-detail"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--border-glass)",
                borderRadius: "var(--radius-md)",
                padding: "12px",
                fontSize: "0.9rem",
                color: "var(--text-tertiary)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
            >
              {detail}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            width: "100%",
            flexDirection: "column",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={resetError}
            style={{ width: "100%", padding: "14px" }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {t("errorFallback.tryAgain")}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={onReload}
            style={{ width: "100%", padding: "14px" }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {t("errorFallback.reload")}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={onGoHome}
            style={{ width: "100%", padding: "14px" }}
          >
            <Home size={18} aria-hidden="true" />
            {t("errorFallback.goHome")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;
