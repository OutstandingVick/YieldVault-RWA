import React, { type ReactNode } from "react";
import EmptyState from "./ui/EmptyState";
import ErrorState from "./ui/ErrorState";

export interface ViewStateProps {
  title: string;
  description: string;
  tone?: "default" | "error";
  action?: ReactNode;
  className?: string;
}

export default function ViewState({
  title,
  description,
  tone = "default",
  action,
  className = "",
}: ViewStateProps) {
  if (tone === "error") {
    return (
      <ErrorState
        title={title}
        description={description}
        tone="error"
        secondaryAction={
          React.isValidElement(action)
            ? undefined
            : typeof action === "object" && action !== null && "label" in action
              ? (action as unknown as any)
              : undefined
        }
        className={`view-state view-state-error ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`view-state ${tone === "error" ? "view-state-error" : ""} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <h2 className="view-state-title">{title}</h2>
      <p className="view-state-description">{description}</p>
      {action ? <div className="view-state-action">{action}</div> : null}
    </div>
  );
}
