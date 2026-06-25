import type { ChartMode } from "../lib/userPreferenceStore";

interface ChartModeToggleProps {
  value: ChartMode;
  onChange: (mode: ChartMode) => void;
  "aria-label"?: string;
}

const MODES: { value: ChartMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "area", label: "Area" },
];

export function ChartModeToggle({
  value,
  onChange,
  "aria-label": ariaLabel = "Chart visualization mode",
}: ChartModeToggleProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex gap-xs"
      style={{
        background: "rgba(255,255,255,0.03)",
        padding: "4px",
        borderRadius: "8px",
        border: "1px solid var(--border-glass)",
      }}
    >
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={value === mode.value}
          onClick={() => onChange(mode.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: value === mode.value ? "var(--accent-cyan)" : "transparent",
            color: value === mode.value ? "black" : "var(--text-secondary)",
            border: "none",
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
