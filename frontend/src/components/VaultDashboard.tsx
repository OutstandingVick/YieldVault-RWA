import React, { useEffect, useState } from "react";
import {
  Activity,
  ShieldCheck,
  TrendingUp,
  Wallet as WalletIcon,
} from "./icons";
import { useVault } from "../context/VaultContext";
import ApiStatusBanner from "./ApiStatusBanner";
import VaultPerformanceChart from "./VaultPerformanceChart";
import { useToast } from "../context/ToastContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import { FormField, SubmitButton } from "../forms";
import CopyButton from "./CopyButton";
import { useDepositMutation, useWithdrawMutation } from "../hooks/useVaultMutations";

interface VaultDashboardProps {
  walletAddress: string | null;
  usdcBalance?: number;
}

const VaultDashboard: React.FC<VaultDashboardProps> = ({
  walletAddress,
  usdcBalance = 0,
}) => {
  const {
    formattedTvl,
    formattedApy,
    summary,
    error,
    isLoading,
    isCapReached,
    isCapWarning,
    utilization,
  } = useVault();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  const depositMutation = useDepositMutation();
  const withdrawMutation = useWithdrawMutation();
  const isBusy = depositMutation.isPending || withdrawMutation.isPending;

  useEffect(() => {
    const handleTrigger = () => {
      setActiveTab("deposit");
      window.setTimeout(() => {
        const input = document.querySelector(".input-field") as
          | HTMLInputElement
          | null;
        input?.focus();
      }, 0);
    };
    window.addEventListener("TRIGGER_DEPOSIT", handleTrigger);
    return () => window.removeEventListener("TRIGGER_DEPOSIT", handleTrigger);
  }, []);

  const availableBalance = walletAddress ? usdcBalance : 0;
  const strategy = summary.strategy;

  const enteredAmount = Number(amount);
  const isValidAmount = Number.isFinite(enteredAmount) && enteredAmount > 0;

  const managementFeeBps = 35;
  const estimatedFee = isValidAmount
    ? (enteredAmount * managementFeeBps) / 10_000
    : 0;
  const estimatedNetAmount = isValidAmount
    ? Math.max(enteredAmount - estimatedFee, 0)
    : 0;

  const handleTransaction = async (actionType: "deposit" | "withdraw") => {
    const value = Number(amount);

    if (!walletAddress) {
      toast.warning({
        title: "Wallet required",
        description: "Connect your wallet before submitting a transaction.",
      });
      return;
    }

    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.warning({
        title: "Enter a valid amount",
        description: "Choose a valid USDC amount before submitting the transaction.",
      });
      return;
    }

    if (actionType === "withdraw" && value > availableBalance) {
      toast.warning({
        title: "Insufficient balance",
        description: "The withdrawal amount exceeds your available USDC balance.",
      });
      return;
    }

    if (actionType === "deposit" && value > availableBalance) {
      toast.warning({
        title: "Amount exceeds maximum",
        description: "Deposit amount cannot exceed your available USDC balance.",
      });
      return;
    }

    try {
      if (actionType === "deposit") {
        await depositMutation.mutateAsync({ walletAddress, amount: value });
      } else {
        await withdrawMutation.mutateAsync({ walletAddress, amount: value });
      }

      setAmount("");
      toast.success({
        title:
          actionType === "deposit" ? "Deposit Successful" : "Withdrawal Successful",
        description:
          actionType === "deposit"
            ? `${value.toFixed(2)} USDC has been deposited into the vault.`
            : `${value.toFixed(2)} USDC has been withdrawn from the vault.`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred during the transaction.";
      toast.error({
        title: "Transaction Failed",
        description: message,
      });
    }
  };

  const capLabel = (() => {
    if (!isCapReached && !isCapWarning) return null;
    const percent = (utilization * 100).toFixed(1);
    if (isCapReached) return `Vault Capacity Reached (${percent}%)`;
    return `Vault Near Capacity (${percent}%)`;
  })();

  const strategyExchangeRateLabel = `1 yvUSDC = ${summary.exchangeRate.toFixed(3)} USDC`;
  const strategyNetworkFeeLabel = summary.networkFeeEstimate;

  return (
    <div className="vault-dashboard gap-lg">
      <div className="vault-dashboard-stats">
        <div className="glass-panel" style={{ padding: "32px" }}>
          {error && <ApiStatusBanner error={error} />}

          <div
            className="vault-stats-header flex justify-between items-center"
            style={{ marginBottom: "24px" }}
          >
            <div>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "4px" }}>
                Global RWA Yield Fund
              </h2>
              <span
                className="tag"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-secondary)",
                }}
              >
                Tokens: USDC
              </span>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Current APY
              </div>
              <div
                className="text-gradient"
                style={{
                  fontSize: "2rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                }}
              >
                {formattedApy}
              </div>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border-glass)", margin: "24px 0" }} />

          <div className="vault-stats-meta flex gap-xl" style={{ marginBottom: "32px" }}>
            <div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  marginBottom: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Total Value Locked
                <span
                  className="flex items-center gap-xs"
                  style={{
                    color: "var(--accent-cyan)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <Activity size={10} className={isLoading ? "animate-pulse" : undefined} />
                  {isLoading ? "Syncing" : "Live"}
                </span>
              </div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                }}
              >
                {formattedTvl}
              </div>
            </div>

            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                Underlying Asset
              </div>
              <div className="flex items-center gap-sm">
                <ShieldCheck size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>
                  {summary.assetLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "20px", background: "var(--bg-muted)" }}>
            <h3
              style={{
                fontSize: "1.1rem",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <TrendingUp size={18} color="var(--accent-purple)" />
              Strategy Overview
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6" }}>
              This vault pools USDC and deploys it into verified tokenized sovereign bonds available on the Stellar network.
            </p>
            <div style={{ marginTop: "12px", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Strategy: <span style={{ color: "var(--text-primary)" }}>{strategy.name}</span>{" "}
              ({strategy.issuer})
            </div>
            <div className="copy-field" style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              <span>Strategy ID:</span>
              <span className="copy-field-value copy-field-value-mono">{strategy.id}</span>
              <CopyButton value={strategy.id} label="strategy ID" />
            </div>
          </div>
        </div>
      </div>

      <div className="vault-dashboard-chart">
        <div className="glass-panel vault-chart-panel">
          <VaultPerformanceChart />
        </div>
      </div>

      <div className="vault-dashboard-actions">
        <div
          className="glass-panel"
          style={{ padding: "32px", position: "relative", overflow: "hidden" }}
        >
          <div className="glass-panel" style={{ padding: "16px 18px", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>BENJI Strategy</h3>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "6px" }}>
              {strategyExchangeRateLabel}
            </div>
            <div style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 600 }}>
              {strategyNetworkFeeLabel}
            </div>
          </div>

          {!walletAddress && (
            <div
              className="wallet-overlay"
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--bg-overlay)",
                backdropFilter: "blur(8px)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px",
                textAlign: "center",
              }}
            >
              <WalletIcon size={48} color="var(--accent-cyan)" style={{ marginBottom: "16px", opacity: 0.8 }} />
              <h3>Wallet Not Connected</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Please connect your Freighter wallet to deposit USDC and earn RWA yields.
              </p>
            </div>
          )}

          <Tabs
            value={activeTab}
            defaultValue="deposit"
            onValueChange={(v) => setActiveTab(v as "deposit" | "withdraw")}
          >
            <TabsList style={{ marginBottom: "24px" }}>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>

            {(["deposit", "withdraw"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                {tab === "deposit" && capLabel ? (
                  <div
                    className="glass-panel"
                    style={{
                      padding: "12px 14px",
                      marginBottom: "16px",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {capLabel}
                  </div>
                ) : null}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleTransaction(tab);
                  }}
                >
                  <div style={{ marginBottom: "24px" }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: "16px" }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        {tab === "deposit" ? "Amount to deposit" : "Amount to withdraw"}
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        Balance:{" "}
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{walletAddress ? availableBalance.toFixed(2) : "0.00"}</span>
                      </div>
                    </div>

                    <FormField
                      label={tab === "deposit" ? "Deposit amount" : "Withdrawal amount"}
                      name={`${tab}-amount`}
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={isBusy || (tab === "deposit" && isCapReached)}
                    />

                    <div className="flex justify-between items-center" style={{ marginTop: "12px" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        Asset: USDC
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setAmount(availableBalance.toString())}
                        disabled={!walletAddress || availableBalance <= 0 || isBusy || (tab === "deposit" && isCapReached)}
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <div
                    className="glass-panel"
                    style={{
                      padding: "14px 16px",
                      background: "rgba(0, 0, 0, 0.15)",
                      marginBottom: "16px",
                    }}
                  >
                    <div className="flex justify-between items-center" style={{ marginBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>
                        Estimated protocol fee
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                        {isValidAmount ? `${estimatedFee.toFixed(4)} USDC` : "0.0000 USDC"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {tab === "deposit" ? "Estimated net deposit" : "Estimated net withdrawal"}
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                        {isValidAmount ? `${estimatedNetAmount.toFixed(4)} USDC` : "0.0000 USDC"}
                      </span>
                    </div>
                    {/* Network fee estimate is shown in the BENJI strategy panel above. */}
                  </div>

                  <SubmitButton
                    loading={isBusy && activeTab === tab}
                    disabled={
                      !walletAddress ||
                      isBusy ||
                      !amount ||
                      Number(amount) <= 0 ||
                      (tab === "deposit" && isCapReached)
                    }
                    label={tab === "deposit" ? (isCapReached ? "Vault is full" : "Approve & Deposit") : "Withdraw Funds"}
                    loadingLabel="Processing Transaction..."
                  />
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default VaultDashboard;
