import React from "react";
import { Activity, AlertCircle } from "./icons";
import { useTvlTicker } from "../hooks/useTvlTicker";
import { formatCurrency } from "../lib/formatters";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

/**
 * Live TVL ticker for the dashboard header / navbar.
 * Polls every 15 s, animates number changes, shows a stale indicator
 * when the last successful poll is older than 60 s.
 * Displays offline indicator when connection is lost.
 */
const TvlTicker: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const { displayTvl, isStale } = useTvlTicker(isOnline);

  const isWarning = isStale || !isOnline;

  return (
    <div
      aria-live="polite"
      aria-label={!isOnline ? "Offline - TVL data paused" : `Total Value Locked: ${formatCurrency(displayTvl, "USD", 0)}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "999px",
        border: isWarning
          ? "1px solid rgba(255, 159, 10, 0.45)"
          : "1px solid rgba(0, 240, 255, 0.25)",
        background: isWarning
          ? "rgba(255, 159, 10, 0.08)"
          : "rgba(0, 240, 255, 0.06)",
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        transition: "border-color 0.3s, background 0.3s",
        whiteSpace: "nowrap",
      }}
    >
      {isWarning ? (
        <AlertCircle
          size={12}
          color="rgba(255, 159, 10, 0.9)"
          aria-label={!isOnline ? "Connection lost" : "Data may be stale"}
        />
      ) : (
        <Activity
          size={12}
          color="var(--accent-cyan)"
          style={{ animation: "pulse 2s ease-in-out infinite" }}
          aria-hidden="true"
        />
      )}
      
      {!isOnline ? (
        <span style={{ color: "rgba(255, 159, 10, 0.9)" }}>
          Offline – polling paused
        </span>
      ) : (
        <>
          <span style={{ color: "var(--text-secondary)" }}>TVL</span>
          <span
            style={{
              color: isStale ? "rgba(255, 159, 10, 0.9)" : "var(--accent-cyan)",
              fontFamily: "var(--font-display)",
              transition: "color 0.3s",
            }}
          >
            {formatCurrency(displayTvl, "USD", 0)}
          </span>
          {isStale && (
            <span
              style={{ color: "rgba(255, 159, 10, 0.7)", fontSize: "0.7rem" }}
              title="Data may be outdated"
            >
              stale
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default TvlTicker;
