import React, { useState } from "react";
import { useNetworkQuality, type NetworkQuality } from "../hooks/useNetworkQuality";
import { AlertTriangle, Clock, Wifi, X } from "./icons";

const CONFIG: Record<NetworkQuality, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  fast: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", label: "Fast network", icon: <Wifi size={14} /> },
  normal: { color: "var(--text-secondary)", bg: "transparent", label: "Normal network", icon: <Wifi size={14} /> },
  slow: {
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.1)",
    label: "Slow network — reduced refresh rate",
    icon: <Clock size={14} />,
  },
  degraded: {
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.1)",
    label: "Degraded network — data may be stale",
    icon: <AlertTriangle size={14} />,
  },
};

const HighLatencyBanner: React.FC = () => {
  const { quality, latencyMs, jitterMs } = useNetworkQuality();
  const [dismissed, setDismissed] = useState(false);

  if (quality === "fast" || quality === "normal" || dismissed) return null;

  const cfg = CONFIG[quality];

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 14px",
        borderRadius: "8px",
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        color: cfg.color,
        fontSize: "0.8rem",
        lineHeight: 1.4,
        marginBottom: "12px",
        animation: "fade-in 0.3s ease-out",
      }}
    >
      {cfg.icon}
      <span style={{ flex: 1 }}>
        {cfg.label}
        <span style={{ opacity: 0.7, fontSize: "0.72rem", marginLeft: 8 }}>
          ({latencyMs}ms{quality === "degraded" ? `, jitter ${jitterMs}ms` : ""})
        </span>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          all: "unset",
          cursor: "pointer",
          opacity: 0.6,
          display: "flex",
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default HighLatencyBanner;
