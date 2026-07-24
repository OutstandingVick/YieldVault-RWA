import { useTransactionHistory } from "./useTransactionData";

export function usePendingTransactionCount(walletAddress: string | null): number {
  const { data: transactions } = useTransactionHistory(walletAddress);

  if (!transactions) return 0;

  return transactions.filter(
    (tx) => tx.status === "pending" || tx.status === "failed",
  ).length;
}
