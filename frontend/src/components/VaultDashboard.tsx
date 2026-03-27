import { useEffect, useState } from "react";
import {
  Activity,
  ShieldCheck,
  TrendingUp,
  Wallet as WalletIcon,
} from "./icons";
import { hasCustomRpcConfig, networkConfig } from "../config/network";
import { useVault } from "../context/VaultContext";
import ApiStatusBanner from "./ApiStatusBanner";
import VaultPerformanceChart from "./VaultPerformanceChart";
import { useToast } from "../context/ToastContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { FormField, SubmitButton } from "../forms";

interface VaultDashboardProps {
  walletAddress: string | null;
  usdcBalance?: number;
}

const VaultDashboard: React.FC<VaultDashboardProps> = ({ walletAddress, usdcBalance = 0 }) => {
  const { formattedTvl, formattedApy, summary, error, isLoading } = useVault();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState<"deposit" | "withdraw" | null>(
    null,
  );
  const [fakeBalance, setFakeBalance] = useState(usdcBalance);

  useEffect(() => {
    setFakeBalance(usdcBalance);
  }, [usdcBalance]);

  const strategy = summary.strategy;

  const runTransaction = async (actionType: "deposit" | "withdraw") => {
    const parsedAmount = Number(amount);
    if (!walletAddress) {
      toast.warning({
        title: "Wallet required",
        description: "Connect your wallet before submitting a transaction.",
      });
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.warning({
        title: "Invalid amount",
        description: "Enter an amount greater than 0.",
      });
      return;
    }

    setIsProcessing(actionType);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (actionType === "deposit") {
          setFakeBalance((prev) => prev + parsedAmount);
        } else {
          setFakeBalance((prev) => Math.max(0, prev - parsedAmount));
        }
        setAmount("");
        setIsProcessing(null);
        toast.success({
          title: actionType === "deposit" ? "Deposit queued" : "Withdrawal queued",
          description:
            actionType === "deposit"
              ? `${parsedAmount.toFixed(2)} USDC has been added to pending activity.`
              : `${parsedAmount.toFixed(2)} USDC has been queued for withdrawal.`,
        });
        resolve();
      }, 2000);
    });
  };

  const isBusy = isProcessing !== null;
  const balanceLabel = fakeBalance.toFixed(2);
  const isAmountValid = Number(amount) > 0;

  return (
    <div className="vault-dashboard gap-lg">
            {/* Stats — grid area: stats */}
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

          <div
            style={{
              height: "1px",
              background: "var(--border-glass)",
              margin: "24px 0",
            }}
          />

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
                  className="flex items-center"
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
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                lineHeight: "1.6",
              }}
            >
              This vault pools USDC and deploys it into verified tokenized sovereign
              bonds available on the Stellar network. Yields are algorithmically
              harvested and auto-compounded daily into the vault token price.
            </p>
            <div style={{ marginTop: "12px", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Strategy: <span style={{ color: "var(--text-primary)" }}>{strategy.name}</span>{" "}
              ({strategy.issuer})
            </div>
            <div style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              RPC: {hasCustomRpcConfig ? "Custom" : "Default"} - {networkConfig.rpcUrl}
            </div>
          </div>
        </div>
      </div>

            {/* Chart — grid area: chart */}
      <div className="vault-dashboard-chart">
        <div className="glass-panel vault-chart-panel">
          <VaultPerformanceChart />
        </div>
      </div>

            {/* Deposit / withdraw — grid area: actions */}
      <div className="vault-dashboard-actions">
        <div
          className="glass-panel"
          style={{ padding: "32px", position: "relative", overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "150px",
              height: "150px",
              background: "var(--accent-purple)",
              filter: "blur(80px)",
              opacity: 0.2,
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />

          {!walletAddress && (
            <div
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
              aria-live="polite"
            >
              <WalletIcon
                size={48}
                color="var(--accent-cyan)"
                style={{ marginBottom: "16px", opacity: 0.8 }}
              />
              <h3 style={{ marginBottom: "8px" }}>Wallet Not Connected</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  marginBottom: "24px",
                }}
              >
                Please connect your Freighter wallet to deposit USDC and earn RWA
                yields.
              </p>
            </div>
          )}

          <Tabs
            defaultValue="deposit"
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as "deposit" | "withdraw");
              setAmount("");
            }}
          >
            <TabsList style={{ marginBottom: "24px" }}>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void runTransaction("deposit");
                }}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: "16px" }}>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Deposit amount
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Balance:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {walletAddress ? balanceLabel : "0.00"}
                    </span>
                  </div>
                </div>

                <FormField
                  label="Amount to deposit"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />

                <div className="flex justify-between" style={{ margin: "16px 0 24px" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Asset: USDC
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setAmount(fakeBalance.toString())}
                  >
                    MAX
                  </button>
                </div>

                <SubmitButton
                  loading={isProcessing === "deposit"}
                  disabled={!walletAddress || isBusy || !isAmountValid}
                  label="Approve & Deposit"
                  loadingLabel="Processing Transaction..."
                />
              </form>
            </TabsContent>

            <TabsContent value="withdraw">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void runTransaction("withdraw");
                }}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: "16px" }}>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Withdraw amount
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Balance:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {walletAddress ? balanceLabel : "0.00"}
                    </span>
                  </div>
                </div>

                <FormField
                  label="Amount to withdraw"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />

                <div className="flex justify-between" style={{ margin: "16px 0 24px" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    Asset: USDC
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setAmount(fakeBalance.toString())}
                  >
                    MAX
                  </button>
                </div>

                <SubmitButton
                  loading={isProcessing === "withdraw"}
                  disabled={!walletAddress || isBusy || !isAmountValid}
                  label="Withdraw Funds"
                  loadingLabel="Processing Transaction..."
                />
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default VaultDashboard;
