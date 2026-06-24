import React from "react";
import { AlertTriangle } from "./icons";
import type {
  TransactionConflictDetails,
  TransactionConflictResolution,
} from "../lib/transactionConflict";
import type { StaleFieldChange } from "../lib/staleSubmissionDetection";

export interface TransactionConflictResolverProps {
  conflict: TransactionConflictDetails;
  staleChanges?: StaleFieldChange[];
  onResolve: (resolution: TransactionConflictResolution) => void;
  isResolving?: boolean;
}

const CONFLICT_COPY: Record<
  TransactionConflictDetails["type"],
  { title: string; description: string }
> = {
  "stale-form": {
    title: "Transaction details changed",
    description:
      "Market conditions or your wallet balance changed while you were reviewing. Resolve the conflict before submitting.",
  },
  "wallet-in-progress": {
    title: "Wallet operation in progress",
    description:
      "Another deposit or withdrawal is already in progress for this wallet. Wait for it to finish or retry shortly.",
  },
  "idempotency-conflict": {
    title: "Duplicate transaction intent",
    description:
      "This submission conflicts with a previous request. Choose how to proceed without creating a duplicate on-chain transaction.",
  },
};

const TransactionConflictResolver: React.FC<TransactionConflictResolverProps> = ({
  conflict,
  staleChanges = [],
  onResolve,
  isResolving = false,
}) => {
  const copy = CONFLICT_COPY[conflict.type];

  return (
    <section
      className="glass-panel transaction-conflict-resolver"
      role="alertdialog"
      aria-labelledby="transaction-conflict-title"
      aria-describedby="transaction-conflict-desc"
      style={{
        padding: "16px",
        marginBottom: "20px",
        border: "1px solid rgba(255, 159, 10, 0.45)",
        background: "rgba(255, 159, 10, 0.08)",
      }}
    >
      <div className="flex items-start gap-sm" style={{ marginBottom: "12px" }}>
        <AlertTriangle
          size={18}
          color="var(--text-warning, #f59e0b)"
          style={{ marginTop: "2px", flexShrink: 0 }}
        />
        <div>
          <h4
            id="transaction-conflict-title"
            style={{ margin: "0 0 6px", fontSize: "0.95rem", fontWeight: 600 }}
          >
            {copy.title}
          </h4>
          <p
            id="transaction-conflict-desc"
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            {conflict.message || copy.description}
          </p>
        </div>
      </div>

      {staleChanges.length > 0 && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.18)",
            border: "1px solid var(--border-glass)",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            Changed fields
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {staleChanges.map((change) => (
              <li
                key={change.field}
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-primary)",
                  marginBottom: "4px",
                }}
              >
                <strong>{change.label}:</strong> {change.previous} → {change.current}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
        {conflict.type === "stale-form" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isResolving}
              onClick={() => onResolve("update-values")}
            >
              Use updated values
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isResolving}
              onClick={() => onResolve("proceed-anyway")}
            >
              Proceed anyway
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isResolving}
              onClick={() => onResolve("dismiss")}
            >
              Go back
            </button>
          </>
        )}

        {conflict.type === "wallet-in-progress" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isResolving}
              onClick={() => onResolve("retry")}
            >
              Retry
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isResolving}
              onClick={() => onResolve("dismiss")}
            >
              Cancel
            </button>
          </>
        )}

        {conflict.type === "idempotency-conflict" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isResolving}
              onClick={() => onResolve("new-intent")}
            >
              Use new intent
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isResolving}
              onClick={() => onResolve("retry-same")}
            >
              Resubmit same request
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isResolving}
              onClick={() => onResolve("dismiss")}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default TransactionConflictResolver;
