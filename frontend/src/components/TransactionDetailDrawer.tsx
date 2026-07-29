import React from "react";
import { Link } from "react-router-dom";
import Badge from "./Badge";
import CopyButton from "./CopyButton";
import Drawer from "./Drawer";
import TransactionTimeline from "./TransactionTimeline";
import { ExternalLink, Loader2 } from "./icons";
import { useTransactionTimeline } from "../hooks/useTransactionTimeline";
import { useTranslation } from "../i18n";
import {
  formatAmount,
  formatTimestamp,
  type Transaction,
} from "../lib/transactionApi";
import { getStellarExplorerUrl } from "../lib/security";
import { networkConfig } from "../config/network";

const STATUS_COLOR_MAP: Record<
  Transaction["status"],
  "success" | "warning" | "error"
> = {
  completed: "success",
  pending: "warning",
  failed: "error",
};

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="receipt-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const PendingTimelineSection: React.FC<{ txHash: string }> = ({ txHash }) => {
  const { status, elapsedSeconds, errorMessage } = useTransactionTimeline({
    txHash,
  });
  const { t } = useTranslation();

  return (
    <section
      className="drawer-timeline-section"
      aria-label={t("txDetail.liveStatusSection")}
    >
      <h3 className="drawer-section-title">{t("txDetail.liveStatusSection")}</h3>
      <TransactionTimeline
        status={status}
        txHash={txHash}
        elapsedSeconds={elapsedSeconds}
        errorMessage={errorMessage}
      />
    </section>
  );
};

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!transaction) return null;

  const explorerUrl = getStellarExplorerUrl(
    transaction.transactionHash,
    networkConfig.isTestnet ? "testnet" : "mainnet",
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t("txDetail.title")}
      description={t("txDetail.description")}
      aria-labelledby="transaction-detail-title"
      aria-describedby="transaction-detail-desc"
      footer={
        <Link
          to={`/receipt/${transaction.transactionHash}`}
          className="btn btn-secondary"
          onClick={onClose}
        >
          {t("txDetail.viewReceipt")}
        </Link>
      }
    >
      <dl className="receipt-fields">
        <DetailRow label={t("txHistory.typeHeader")}>
          <Badge
            variant="status"
            color={transaction.type === "deposit" ? "cyan" : "error"}
          >
            {transaction.type}
          </Badge>
        </DetailRow>

        <DetailRow label={t("txHistory.statusHeader")}>
          <Badge
            variant="status"
            color={STATUS_COLOR_MAP[transaction.status]}
            icon={
              transaction.status === "pending" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : undefined
            }
          >
            {transaction.status}
          </Badge>
        </DetailRow>

        <DetailRow label={t("txHistory.amountHeader")}>
          {formatAmount(transaction.amount, transaction.asset)}
        </DetailRow>

        <DetailRow label={t("txHistory.assetHeader")}>
          {transaction.asset ?? "—"}
        </DetailRow>

        <DetailRow label={t("txHistory.dateHeader")}>
          {formatTimestamp(transaction.timestamp)}
        </DetailRow>

        <DetailRow label={t("txHistory.hashHeader")}>
          <span className="drawer-hash-row">
            <code className="receipt-mono">{transaction.transactionHash}</code>
            <CopyButton
              value={transaction.transactionHash}
              label={t("txDetail.hashLabel")}
            />
          </span>
        </DetailRow>
      </dl>

      <div className="drawer-actions">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline drawer-explorer-link"
        >
          <ExternalLink size={16} aria-hidden="true" />
          {t("txDetail.viewOnExplorer")}
        </a>
      </div>

      {transaction.status === "pending" && (
        <PendingTimelineSection txHash={transaction.transactionHash} />
      )}
    </Drawer>
  );
};

export default TransactionDetailDrawer;
