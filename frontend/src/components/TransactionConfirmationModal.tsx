import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, ShieldAlert, Check, Loader2, Copy } from "./icons";
import { useTranslation } from "../i18n";
import type { TransactionSummary } from "../types/transaction";
import { copyTextToClipboard } from "../lib/clipboard";

interface TransactionConfirmationModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;

  /** Called when user clicks Cancel or presses Escape */
  onCancel: () => void;

  /** Called when user clicks Confirm button */
  onConfirm: () => void;

  /** Disables confirm button and shows loading spinner */
  isLoading?: boolean;

  /** Complete transaction summary for display and validation */
  summary: TransactionSummary;
}

/**
 * Security-focused transaction confirmation modal.
 *
 * Displays all transaction details (amount, asset, network, fee, contract)
 * and highlights unusual values with warnings.
 * Requires explicit user confirmation before wallet signing proceeds.
 *
 * Security Properties:
 * - Modal is shown for every sensitive action without exception
 * - Cannot be dismissed by backdrop click (explicit confirmation required)
 * - Full contract addresses are displayed and copied, never truncated
 * - Focus is trapped within modal, Escape calls onCancel
 * - All ARIA attributes present for accessibility
 */
export const TransactionConfirmationModal: React.FC<TransactionConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  isLoading = false,
  summary,
}) => {
  const { t } = useTranslation();

  // Determine if confirm button should use warning style
  const hasWarnings = summary.isUnusualAmount || summary.isUnusualFee || summary.isUnknownContract;
  const confirmButtonLabel = hasWarnings ? "Confirm Anyway" : "Confirm";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Confirm ${summary.actionType}`}
      size="md"
      closeOnBackdropClick={false}
      closeOnEscape={true}
      aria-labelledby="modal-title-confirm"
      aria-describedby="modal-desc-risk-summary"
    >
      <div style={{ padding: "12px 0" }}>
        {/* Warnings Section: Unusual Values */}
        {hasWarnings && (
          <div
            style={{
              background: "rgba(255, 159, 10, 0.1)",
              border: "1px solid var(--text-warning)",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "20px",
              display: "flex",
              gap: "12px",
            }}
          >
            <ShieldAlert color="var(--text-warning)" size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-warning)", marginBottom: "4px" }}>
                Review Transaction Details
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {summary.isUnusualAmount && (
                  <li>This amount is unusually large.</li>
                )}
                {summary.isUnusualFee && (
                  <li>This fee is higher than usual.</li>
                )}
                {summary.isUnknownContract && (
                  <li>This contract address is not in the verified list.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Transaction Details Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
          {/* Amount */}
          <div className="flex justify-between items-start">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Amount</span>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: summary.isUnusualAmount ? "var(--text-warning)" : "var(--text-primary)",
                }}
              >
                {summary.amount}
              </div>
              {summary.isUnusualAmount && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-warning)", marginTop: "2px" }}>
                  Unusually large
                </div>
              )}
            </div>
          </div>

          {/* Asset */}
          <div className="flex justify-between items-center">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Asset</span>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{summary.asset}</span>
          </div>

          {/* Network */}
          <div className="flex justify-between items-center">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Network</span>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{summary.network}</span>
          </div>

          {/* Estimated Fee */}
          <div className="flex justify-between items-start">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Estimated Fee</span>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: summary.isUnusualFee ? "var(--text-warning)" : "var(--text-primary)",
                }}
              >
                {summary.estimatedFee}
              </div>
              {summary.isUnusualFee && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-warning)", marginTop: "2px" }}>
                  Higher than usual
                </div>
              )}
            </div>
          </div>

          {/* Contract Address */}
          <div className="flex justify-between items-start">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Contract</span>
            <div style={{ textAlign: "right", maxWidth: "50%" }}>
              {summary.contractName && (
                <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "4px" }}>
                  {summary.contractName}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  justifyContent: "flex-end",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: summary.isUnknownContract ? "var(--text-warning)" : "var(--text-secondary)",
                  wordBreak: "break-all",
                }}
              >
                <span>{summary.contractAddress}</span>
                <button
                  type="button"
                  onClick={() => copyTextToClipboard(summary.contractAddress)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-cyan)",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                  title="Copy full address"
                  aria-label="Copy contract address to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
              {summary.isUnknownContract && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-warning)", marginTop: "4px" }}>
                  Not in verified list
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--border-glass)",
            margin: "20px 0",
          }}
        />

        {/* Risk Summary Section */}
        <div
          id="modal-desc-risk-summary"
          style={{
            background: "rgba(0, 240, 255, 0.05)",
            border: "1px solid rgba(0, 240, 255, 0.2)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "24px",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            lineHeight: "1.5",
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: "var(--accent-cyan)", marginBottom: "6px" }}>
            ⚠️ Important
          </p>
          <p style={{ margin: 0 }}>
            This transaction cannot be reversed once signed. Review all details carefully before confirming. Only proceed if you understand and accept the transaction parameters.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-md">
          <button
            type="button"
            className="btn btn-outline"
            style={{ flex: 1 }}
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={hasWarnings ? "btn btn-warning" : "btn btn-primary"}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spin" style={{ animation: "spin 0.9s linear infinite" }} />
                Signing...
              </>
            ) : (
              <>
                <Check size={18} />
                {confirmButtonLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
