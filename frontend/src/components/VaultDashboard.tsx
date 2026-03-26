import { useState } from "react";
import { Activity, ShieldCheck, TrendingUp, Wallet as WalletIcon } from "./icons";
import { hasCustomRpcConfig, networkConfig } from "../config/network";
import { useVault } from "../context/VaultContext";
import ApiStatusBanner from "./ApiStatusBanner";
import VaultPerformanceChart from "./VaultPerformanceChart";
import { useToast } from "../context/ToastContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { FormField, SubmitButton, useForm, type ValidationSchema } from "../forms";
import ViewState from "./ViewState";

interface VaultDashboardProps {
  walletAddress: string | null;
  usdcBalance?: number;
}

const VaultDashboard: React.FC<VaultDashboardProps> = ({
  walletAddress,
  usdcBalance = 0,
}) => {
  const { formattedTvl, formattedApy, summary, error, isLoading } = useVault();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [pendingBalanceChange, setPendingBalanceChange] = useState(0);

  const schema: ValidationSchema<{ amount: string }> = {
    amount: {
      required: "Enter an amount to continue.",
      custom: (value) => {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) return "Enter a valid number.";
        if (parsed <= 0) return "Amount must be greater than 0.";
        return undefined;
      },
    },
  };

  const { values, errors, handleChange, handleBlur, handleSubmit } = useForm(
    { amount: "" },
    schema,
  );

  const effectiveBalance = Math.max(0, usdcBalance + pendingBalanceChange);

  const handleTransaction = async () => {
    if (!walletAddress) {
      toast.warning({
        title: "Wallet required",
        description: "Connect your wallet before submitting a transaction.",
      });
      return;
    }

    setIsProcessing(true);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const value = Number(values.amount);
        if (activeTab === "deposit") setPendingBalanceChange((prev) => prev + value);
        if (activeTab === "withdraw") setPendingBalanceChange((prev) => prev - value);
        handleChange({
          target: { name: "amount", value: "" },
        } as Parameters<typeof handleChange>[0]);
        setIsProcessing(false);
        toast.success({
          title: activeTab === "deposit" ? "Deposit queued" : "Withdrawal queued",
          description: `${value.toFixed(2)} USDC request submitted.`,
        });
        resolve();
      }, 1200);
    });
  };

  return (
    <div className="vault-dashboard gap-lg">
      <section className="vault-dashboard-stats">
        <div className="glass-panel" style={{ padding: "32px" }}>
          {error && <ApiStatusBanner error={error} />}
          {isLoading && !error && (
            <ViewState
              title="Loading vault analytics"
              description="Fetching latest APY and TVL from on-chain data."
            />
          )}
          <div className="vault-stats-header flex justify-between items-center">
            <div>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "4px" }}>
                Global RWA Yield Fund
              </h2>
              <span className="tag" style={{ color: "var(--text-secondary)" }}>
                Tokens: USDC
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Current APY
              </div>
              <div className="text-gradient" style={{ fontSize: "2rem", fontWeight: 700 }}>
                {formattedApy}
              </div>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border-glass)", margin: "24px 0" }} />
          <div className="vault-stats-meta flex gap-xl">
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "4px", display: "flex", gap: "6px", alignItems: "center" }}>
                Total Value Locked
                <span style={{ color: "var(--accent-cyan)", fontSize: "0.7rem", fontWeight: 600 }}>
                  <Activity size={10} /> {isLoading ? "SYNCING" : "LIVE"}
                </span>
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{formattedTvl}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                Underlying Asset
              </div>
              <div className="flex items-center gap-sm">
                <ShieldCheck size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{summary.assetLabel}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ marginTop: "20px", padding: "20px", background: "var(--bg-muted)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <TrendingUp size={18} color="var(--accent-purple)" />
              Strategy Overview
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Strategy: {summary.strategy.name} ({summary.strategy.issuer})
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "8px" }}>
              RPC: {hasCustomRpcConfig ? "Custom" : "Default"} - {networkConfig.rpcUrl}
            </p>
          </div>
        </div>
      </section>

      <section className="vault-dashboard-chart">
        <div className="glass-panel vault-chart-panel">
          <VaultPerformanceChart />
        </div>
      </section>

      <section className="vault-dashboard-actions">
        <div className="glass-panel" style={{ padding: "32px", position: "relative" }}>
          {!walletAddress && (
            <ViewState
              title="Wallet not connected"
              description="Connect your Freighter wallet to deposit or withdraw USDC."
              action={<WalletIcon size={20} color="var(--accent-cyan)" />}
            />
          )}
          <Tabs
            defaultValue="deposit"
            syncWithUrl
            onValueChange={(value) => setActiveTab(value as "deposit" | "withdraw")}
          >
            <TabsList style={{ marginBottom: "24px" }}>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              <form onSubmit={handleSubmit(handleTransaction)}>
                <FormField
                  label="Amount to deposit"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  value={values.amount}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.amount}
                />
                <div style={{ marginTop: "12px", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  Balance: {effectiveBalance.toFixed(2)} USDC
                </div>
                <SubmitButton
                  loading={isProcessing}
                  disabled={!walletAddress || !values.amount || Number(values.amount) <= 0}
                  label="Approve & Deposit"
                  loadingLabel="Processing..."
                />
              </form>
            </TabsContent>
            <TabsContent value="withdraw">
              <form onSubmit={handleSubmit(handleTransaction)}>
                <FormField
                  label="Amount to withdraw"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  value={values.amount}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.amount}
                />
                <div style={{ marginTop: "12px", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  Balance: {effectiveBalance.toFixed(2)} USDC
                </div>
                <SubmitButton
                  loading={isProcessing}
                  disabled={!walletAddress || !values.amount || Number(values.amount) <= 0}
                  label="Withdraw Funds"
                  loadingLabel="Processing..."
                />
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

export default VaultDashboard;
