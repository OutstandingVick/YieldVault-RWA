import React from "react";
import "./LoadingState.css";

export type LoadingStateSize = "sm" | "md" | "lg" | "full";

export interface LoadingStateProps {
  message?: string;
  size?: LoadingStateSize;
  className?: string;
  customFallback?: React.ReactNode;
  style?: React.CSSProperties;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  size = "md",
  className = "",
  customFallback,
  style,
}) => {
  if (customFallback) {
    return (
      <div
        className={`loading-state-wrapper ${className}`.trim()}
        aria-live="polite"
        aria-busy="true"
        style={style}
      >
        {customFallback}
      </div>
    );
  }

  return (
    <div
      className={`loading-state-container loading-state-${size} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={style}
    >
      <div className="loading-state-spinner" aria-hidden="true" />
      {message && <p className="loading-state-message">{message}</p>}
    </div>
  );
};

export default LoadingState;
