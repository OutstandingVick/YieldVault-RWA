import React, { useRef, useState, useCallback } from "react";
import { useTranslation } from "../i18n";
import type { VaultHealthStatus } from "../lib/vaultHealthApi";

const STATUS_CONFIG = {
  healthy: { dot: "rgb(34, 197, 94)", glow: "rgba(34, 197, 94, 0.35)", labelId: "portfolio.health.healthy" },
  degraded: { dot: "rgb(234, 179, 8)", glow: "rgba(234, 179, 8, 0.35)", labelId: "portfolio.health.degraded" },
  unhealthy: { dot: "rgb(239, 68, 68)", glow: "rgba(239, 68, 68, 0.35)", labelId: "portfolio.health.unhealthy" },
} as const satisfies Record<
  VaultHealthStatus,
  { dot: string; glow: string; labelId: string }
>;

export interface VaultHealthIndicatorProps {
  status: VaultHealthStatus;
  message?: string;
  vaultName?: string;
  /** Compact mode for inline table cells (smaller dot, no outer glow). */
  compact?: boolean;
}

const VaultHealthIndicator: React.FC<VaultHealthIndicatorProps> = ({
  status,
  message,
  vaultName,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<"top" | "bottom">("top");
  const ref = useRef<HTMLDivElement>(null);
  const { dot, glow, labelId } = STATUS_CONFIG[status];
  const label = t(labelId);
  const size = compact ? 8 : 10;

  const onEnter = useCallback(() => {
    if (ref.current) {
      setPos(
        ref.current.getBoundingClientRect().top < window.innerHeight / 3
          ? "bottom"
          : "top",
      );
    }
    setShow(true);
  }, []);

  const ariaLabel = vaultName
    ? `${vaultName}: ${label}${message ? `. ${message}` : ""}`
    : `${t("portfolio.health.title")}: ${label}${message ? `. ${message}` : ""}`;

  return (
    <div
      ref={ref}
      className={`vault-health-indicator vault-health-indicator--${status}${compact ? " vault-health-indicator--compact" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
      onFocus={onEnter}
      onBlur={() => setShow(false)}
    >
      <span
        role="status"
        tabIndex={0}
        aria-label={ariaLabel}
        className="vault-health-indicator__dot"
        style={{
          width: size,
          height: size,
          background: dot,
          boxShadow: compact ? `0 0 0 2px ${glow}` : `0 0 0 3px ${glow}`,
          animation:
            status === "unhealthy"
              ? "vaultHealthPulseHard 1.8s ease-in-out infinite"
              : status === "degraded"
                ? "vaultHealthPulseSoft 2.5s ease-in-out infinite"
                : "none",
        }}
      />

      {show && (
        <div
          role="tooltip"
          className={`vault-health-indicator__tooltip vault-health-indicator__tooltip--${pos}`}
          style={{ borderColor: `${dot}33` }}
        >
          <div className="vault-health-indicator__tooltip-title" style={{ color: dot }}>
            {vaultName ? `${vaultName} — ${label}` : label}
          </div>
          {message && (
            <div className="vault-health-indicator__tooltip-message">{message}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default VaultHealthIndicator;
