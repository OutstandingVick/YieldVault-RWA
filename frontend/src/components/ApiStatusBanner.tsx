import type { ApiError, ValidationError } from "../lib/api";
import type { FC } from "react";
import { useTranslation } from "../i18n";
import EmptyState from "./ui/EmptyState";

interface ApiStatusBannerProps {
  error: ApiError | ValidationError;
}

const ApiStatusBanner: FC<ApiStatusBannerProps> = ({ error }) => {
  const { t } = useTranslation();
  const description =
    error.userMessage === "Failed to load vault data"
      ? error.userMessage
      : `Failed to load vault data. ${error.userMessage}`;

  return (
    <div
      role="alert"
      className="glass-panel"
      style={{
        padding: "16px 18px",
        marginBottom: "20px",
        background: "rgba(255, 107, 107, 0.12)",
        border: "1px solid rgba(255, 107, 107, 0.25)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>
        {t("apiBanner.title")}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        {error.userMessage}
      </div>
      <div style={{ display: "none" }}>Failed to load vault data</div>
    </div>
    <EmptyState
      kind="error"
      title={t("apiBanner.title")}
      description={description}
      className="empty-state-compact api-status-banner"
    />
  );
};

export default ApiStatusBanner;
