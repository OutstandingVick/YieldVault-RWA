import React, { useState, useRef, useCallback } from "react";
import { useWalletHeartbeat, type HeartbeatState } from "../hooks/useWalletHeartbeat";
import { RefreshCw, Wifi, WifiOff } from "./icons";

const CONFIG: Record<HeartbeatState, { dot: string; glow: string; labelKey: string }> = {
  healthy: { dot: "#22c55e", glow: "#22c55e59", labelKey: "wallet.heartbeat.healthy" },
  degraded: { dot: "#eab308", glow: "#eab30859", labelKey: "wallet.heartbeat.degraded" },
  unhealthy: { dot: "#ef4444", glow: "#ef444459", labelKey: "wallet.heartbeat.unhealthy" },
};

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

interface WalletSessionIndicatorProps {
  walletAddress: string | null;
}

const WalletSessionIndicator: React.FC<WalletSessionIndicatorProps> = ({ walletAddress }) => {
  const { state, latencyMs, lastChecked, consecutiveFailures, refetch } = useWalletHeartbeat(walletAddress);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<"top" | "bottom">("top");
  const ref = useRef<HTMLDivElement>(null);
  const { dot, glow } = CONFIG[state];

  const onEnter = useCallback(() => {
    if (ref.current) {
      setPos(ref.current.getBoundingClientRect().top < window.innerHeight / 3 ? "bottom" : "top");
    }
    setShow(true);
  }, []);

  if (!walletAddress) return null;

  return (
    <>
      <style>{`
        @keyframes hb-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
      `}</style>

      <div
        ref={ref}
        style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
        onMouseEnter={onEnter}
        onMouseLeave={() => setShow(false)}
        onFocus={onEnter}
        onBlur={() => setShow(false)}
      >
        <button
          type="button"
          onClick={() => void refetch()}
          aria-label={`Wallet session: ${state}. Latency: ${formatLatency(latencyMs)}`}
          aria-describedby={show ? "wsi-tooltip" : undefined}
          style={{
            all: "unset",
            cursor: "pointer",
            width: 10, height: 10,
            borderRadius: "50%",
            background: dot,
            boxShadow: `0 0 0 3px ${glow}`,
            outline: "revert",
            outlineOffset: 3,
            animation: state === "unhealthy" ? "hb-pulse 1.8s ease-in-out infinite"
                     : state === "degraded" ? "pulseSoft 2.5s ease-in-out infinite"
                     : "none",
          }}
        />

        {show && (
          <div
            id="wsi-tooltip"
            role="tooltip"
            style={{
              position: "absolute",
              ...(pos === "top" ? { bottom: "calc(100% + 10px)" } : { top: "calc(100% + 10px)" }),
              left: "50%", transform: "translateX(-50%)",
              minWidth: 200, maxWidth: 260,
              background: "var(--bg-surface, #1a1a2e)",
              border: `1px solid ${dot}33`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: "0.75rem",
              color: "var(--text-secondary, #94a3b8)",
              zIndex: 1000,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 600, color: dot, marginBottom: 6, fontSize: "0.8rem" }}>
              {state === "healthy" ? <Wifi size={12} style={{ display: "inline", marginRight: 4 }} /> :
               state === "unhealthy" ? <WifiOff size={12} style={{ display: "inline", marginRight: 4 }} /> :
               <RefreshCw size={12} style={{ display: "inline", marginRight: 4 }} />}
              Wallet {state.charAt(0).toUpperCase() + state.slice(1)}
            </div>

            <div style={{ lineHeight: 1.4, marginBottom: 4 }}>
              Latency: {formatLatency(latencyMs)}
            </div>

            {consecutiveFailures > 0 && (
              <div style={{ color: "#ef4444", marginBottom: 4 }}>
                {consecutiveFailures} failed check{consecutiveFailures !== 1 ? "s" : ""}
              </div>
            )}

            {state === "unhealthy" && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  fontSize: "0.7rem",
                  lineHeight: 1.3,
                }}
              >
                Session may be lost. Open Freighter to reconnect.
              </div>
            )}

            {state === "degraded" && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: "rgba(234, 179, 8, 0.1)",
                  color: "#eab308",
                  fontSize: "0.7rem",
                  lineHeight: 1.3,
                }}
              >
                Wallet responses are slow. Check Freighter connection.
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, fontSize: "0.68rem", opacity: 0.5, marginTop: 6 }}>
              Last checked {lastChecked ? relativeTime(lastChecked) : "never"}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

function relativeTime(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default WalletSessionIndicator;
