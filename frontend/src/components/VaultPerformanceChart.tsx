import React, { useState, useMemo } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { TrendingUp, Activity } from "./icons";
import { useVaultHistory } from "../hooks/useVaultData";

type TimeRange = "7D" | "1M" | "3M" | "ALL";

const VaultPerformanceChart: React.FC = () => {
  const { data: rawData = [], isLoading } = useVaultHistory();
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  const filteredData = useMemo(() => {
    if (!rawData.length) return [];
    
    const now = new Date("2026-03-25T10:00:00.000Z"); // Use reference date from summary
    let daysToSubtract = 0;

    switch (timeRange) {
      case "7D": daysToSubtract = 7; break;
      case "1M": daysToSubtract = 30; break;
      case "3M": daysToSubtract = 90; break;
      case "ALL": return rawData;
    }

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysToSubtract);

    return rawData.filter(point => new Date(point.date) >= cutoff);
  }, [rawData, timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel" style={{ 
          padding: "12px", 
          background: "rgba(13, 14, 18, 0.95)", 
          border: "1px solid var(--border-glass)",
          fontSize: "0.85rem"
        }}>
          <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>
            {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>
            Index: {payload[0].value.toFixed(2)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="flex justify-between items-start" style={{ marginBottom: "24px" }}>
        <div>
          <h3
            style={{
              fontSize: "1.1rem",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <TrendingUp size={18} color="var(--accent-cyan)" />
            Vault Performance
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
            yvUSDC share price index (100 = baseline)
          </p>
        </div>

        <div className="flex gap-xs" style={{ background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
          {(["7D", "1M", "3M", "ALL"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: timeRange === range ? "var(--accent-cyan)" : "transparent",
                color: timeRange === range ? "black" : "var(--text-secondary)",
                border: "none",
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: "260px", position: "relative" }}>
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-secondary)", fontSize: "0.9rem", gap: "10px" }}>
            <Activity size={20} className="animate-pulse" />
            Loading historical data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                tickFormatter={(str) => {
                  const date = new Date(str);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="var(--accent-cyan)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default VaultPerformanceChart;
