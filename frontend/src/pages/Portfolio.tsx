import React, { useMemo, useState, useEffect, useRef } from "react";
import { Activity, TrendingUp, DollarSign, Percent, Briefcase, Share2 } from "../components/icons";
import { useTranslation } from "../i18n";
import ApiStatusBanner from "../components/ApiStatusBanner";
import {
  DataTable,
  type DataTableColumn,
} from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import {
  normalizeApiError,
  isValidationError,
  type ApiError,
  type ValidationError
} from "../lib/api";
import CopyButton from "../components/CopyButton";
import {
  getPortfolioHoldings,
  type PortfolioHolding,
} from "../lib/portfolioApi";
import { useClientDataTable } from "../hooks/useClientDataTable";
import HelpIcon from "../components/ui/HelpIcon";
import { useUrlState } from "../hooks/useUrlState";
import { useServerDataTable } from "../hooks/useServerDataTable";
import { useToast } from "../context/ToastContext";
import { usePreferencesContext } from "../context/PreferencesContext";
import YieldBreakdownChart from "../components/YieldBreakdownChart";
import { useReferralStats, useReferralLink } from "../hooks/useReferral";
import ShareModal from "../components/ShareModal";
import EmptyState from "../components/ui/EmptyState";
import FirstTimePortfolioPanel from "../components/FirstTimePortfolioPanel";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber, formatPercent } from "../lib/formatters";
import { displayBalance } from "../lib/maskSensitiveValues";

interface PortfolioProps {
  walletAddress: string | null;
}

const PortfolioSummaryCard: React.FC<{
  label: React.ReactNode;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}> = ({ label, value, icon, trend, trendPositive, onClick, clickable }) => (
  <div
    className="glass-panel"
    style={{
      padding: "24px",
      background: "var(--bg-muted)",
      position: "relative",
      overflow: "hidden",
      border: "1px solid var(--border-glass)",
      transition: "transform 0.2s ease",
      cursor: clickable ? "pointer" : "default",
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = clickable ? "translateY(-4px)" : "translateY(-2px)"}
    onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
    onClick={onClick}
  >
    <div style={{ position: "absolute", top: "-10px", right: "-10px", opacity: 0.05 }}>
      {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { size: 80 })}
    </div>
    <div className="flex items-center gap-sm" style={{ color: "var(--text-secondary)", marginBottom: "12px" }}>
      {icon}
      <span className="text-body-sm" style={{ fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
    </div>
    <div style={{ fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
      {value}
    </div>
    {trend && (
      <div style={{ 
        marginTop: "8px", 
        fontSize: "0.85rem", 
        color: trendPositive ? "var(--accent-cyan)" : "var(--text-error)",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "4px"
      }}>
        {trendPositive ? <TrendingUp size={14} /> : <Activity size={14} />}
        {trend}
      </div>
    )}
  </div>
);

const Portfolio: React.FC<PortfolioProps> = ({ walletAddress }) => {
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const navigate = useNavigate();
  const { preferences } = usePreferencesContext();
  const { t } = useTranslation();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [error, setError] = useState<ApiError | ValidationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const locale = preferences.locale;
  const currency = preferences.currency;

  const formatSensitiveCurrency = useCallback((amount: number, withSign = false) => {
    if (!preferences.showBalances) {
      return "—";
    }
    const formatted = displayBalance(amount, preferences.maskSensitiveValues, (value) =>
      formatCurrency(value, currency, 2, locale),
    );
    if (withSign && amount > 0 && !preferences.maskSensitiveValues) {
      return `+${formatted}`;
    }
    if (withSign && amount >= 0 && preferences.maskSensitiveValues) {
      return `+${formatted}`;
    }
    return formatted;
  }, [preferences.showBalances, preferences.maskSensitiveValues, currency, locale]);

  const { state: urlState, setSearch, setSort, setPage, setPageSize, setFilters, reset } = useUrlState<{ status: string, search: string }>({
    defaultSortBy: "valueUsd",
    defaultSortDirection: "desc",
    defaultPageSize: 4,
    defaultFilters: { status: "all", search: "" },
  });

  const state = {
    ...urlState,
    search: urlState.filters.search || "",
  };

  useServerDataTable({ state });

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    let isMounted = true;

    const loadHoldings = async () => {
      setIsLoading(true);

      try {
        const response = await getPortfolioHoldings({
          walletAddress,
          status: urlState.filters.status || "all",
        });
        if (!isMounted) {
          return;
        }
        setHoldings(response);
        setError(null);
      } catch (unknownError) {
        if (!isMounted) {
          return;
        }
        if (isValidationError(unknownError)) {
          setError(unknownError);
          toastRef.current.error({
            title: t("portfolio.validationFailed"),
            description: unknownError.userMessage,
          });
        } else {
          const nextError = normalizeApiError(unknownError);
          setError(nextError);
          toastRef.current.error({
            title: t("portfolio.syncFailed"),
            description: nextError.userMessage,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHoldings();

    return () => {
      isMounted = false;
    };
  }, [walletAddress, urlState.filters.status, t]);

  const filteredHoldings = React.useMemo(() => {
    if (!urlState.filters.status || urlState.filters.status === "all") {
      return holdings;
    }
    return holdings.filter((h) => h.status === urlState.filters.status);
  }, [holdings, urlState.filters.status]);

  const { rows, page, totalItems, totalPages } = useClientDataTable({
    rows: filteredHoldings,
    state,
    getSearchValue: (row) =>
      `${row.asset} ${row.vaultName} ${row.symbol} ${row.issuer} ${row.status}`,
    getSortValue: (row, columnId) => {
      switch (columnId) {
        case "asset":
          return row.asset;
        case "shares":
          return row.shares;
        case "apy":
          return row.apy;
        case "valueUsd":
          return row.valueUsd;
        case "unrealizedGainUsd":
          return row.unrealizedGainUsd;
        default:
          return row.valueUsd;
      }
    },
  });

  const { data: referralStats } = useReferralStats(walletAddress);
  const { referralLink, referralCode } = useReferralLink(walletAddress);

  const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const totalGain = holdings.reduce(
    (sum, holding) => sum + holding.unrealizedGainUsd,
    0,
  );

  const weightedApy = useMemo(() => {
    if (totalValue === 0) return 0;
    return holdings.reduce((sum, h) => sum + (h.apy * h.valueUsd), 0) / totalValue;
  }, [holdings, totalValue]);

  const columns = useMemo<DataTableColumn<PortfolioHolding>[]>(() => [
    {
      id: "asset",
      header: t("portfolio.assetHeader"),
      sortable: true,
      width: "28%",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.asset}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
            {row.vaultName}
          </div>
          <div
            className="copy-field"
            style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "0.78rem" }}
          >
            <span>Position ID:</span>
            <span className="copy-field-value copy-field-value-mono">{row.id}</span>
            <CopyButton
              value={row.id}
              label="position ID"
              successDescription={`Position ID ${row.id} has been copied to your clipboard.`}
            />
          </div>
        </div>
      ),
    },
    {
      id: "shares",
      header: t("portfolio.sharesHeader"),
      sortable: true,
      align: "right",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {formatNumber(row.shares, { locale, maximumFractionDigits: 2 })} {row.symbol}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
            Issuer: {row.issuer}
          </div>
        </div>
      ),
    },
    {
      id: "apy",
      header: "APY",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
          {formatPercent(row.apy, {
            locale,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: "valueUsd",
      header: t("portfolio.valueHeader"),
      sortable: true,
      align: "right",
      cell: (row) => <span>{formatSensitiveCurrency(row.valueUsd)}</span>,
    },
    {
      id: "unrealizedGainUsd",
      header: t("portfolio.gainHeader"),
      sortable: true,
      align: "right",
      cell: (row) => (
        <span
          style={{
            color:
              row.unrealizedGainUsd >= 0
                ? "var(--accent-cyan)"
                : "var(--text-error)",
            fontWeight: 600,
          }}
        >
          {formatSensitiveCurrency(row.unrealizedGainUsd, true)}
        </span>
      ),
    },
  ], [formatSensitiveCurrency, t]);

  // Compute trend values
  const totalNetValueTrend = useMemo(() => {
    if (totalValue === 0) return "N/A";
    // Calculate 7-day trend (simplified: using current value as proxy)
    // In a real app, this would compare with historical data
    const trendPercent = (totalGain / (totalValue - totalGain)) * 100;
    return Number.isFinite(trendPercent)
      ? `${formatPercent(trendPercent, {
          locale,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} gain`
      : "N/A";
  }, [locale, totalValue, totalGain]);

  const cumulativeYieldTrend = useMemo(() => {
    if (totalGain === 0) return "--";
    return `${formatSensitiveCurrency(totalGain)} realized`;
  }, [totalGain, formatSensitiveCurrency]);

  const weightedApyTrend = useMemo(() => {
    if (holdings.length === 0) return "N/A";
    return `${holdings.length} position${holdings.length !== 1 ? 's' : ''}`;
  }, [holdings.length]);

  const hasActiveHoldingsFilters = Boolean(
    urlState.filters.search ||
      (urlState.filters.status && urlState.filters.status !== "all"),
  );

  const holdingsEmptyMessage = isLoading ? (
    t("portfolio.syncingLabel")
  ) : (
    <EmptyState
      kind={hasActiveHoldingsFilters ? "no-results" : "no-data"}
      className="empty-state-compact"
      title={
        hasActiveHoldingsFilters
          ? t("portfolio.noPositions.title")
          : t("portfolio.noPositions.title")
      }
      description={
        hasActiveHoldingsFilters
          ? t("portfolio.noResults.desc")
          : t("portfolio.noPositions.desc")
      }
      icon={<Briefcase />}
      {...(hasActiveHoldingsFilters
        ? { actionLabel: t("portfolio.resetFilters"), onAction: reset }
        : {})}
    />
  );

  return (
    <div className="glass-panel portfolio-page-panel">
      <PageHeader
        title={
          <>
            Your <span className="text-gradient">Portfolio</span>
          </>
        }
        description={t("portfolio.pageDesc")}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: t("portfolio.pageTitle") },
        ]}
        statusChips={
          walletAddress
            ? [
                {
                  label: `${holdings.length} Positions`,
                  variant: "cyan" as const,
                },
                {
                  label: isLoading ? t("portfolio.syncingLabel") : t("portfolio.liveLabel"),
                  variant: isLoading ? "warning" : "success",
                },
              ]
            : undefined
        }
      />

      {!walletAddress ? (
        <FirstTimePortfolioPanel
          walletConnected={false}
          onConnectWallet={() => window.dispatchEvent(new Event("TRIGGER_WALLET_CONNECT"))}
          onReviewVault={() => navigate("/")}
          onDeposit={() => navigate("/")}
        />
      ) : (
        <div className="flex flex-col gap-lg">
          {error && <ApiStatusBanner error={error} />}

          <div
            className="portfolio-summary-grid"
            style={{ marginBottom: "8px" }}
          >
            <PortfolioSummaryCard
              label={t("portfolio.totalNetValue")}
              value={formatSensitiveCurrency(totalValue)}
              icon={<DollarSign size={20} color="var(--accent-cyan)" />}
              trend={totalNetValueTrend}
              trendPositive={totalGain >= 0}
            />
            <PortfolioSummaryCard
              label={t("portfolio.cumulativeYield")}
              value={formatSensitiveCurrency(totalGain, true)}
              icon={<TrendingUp size={20} color="var(--accent-purple)" />}
              trend={cumulativeYieldTrend}
              trendPositive={totalGain >= 0}
            />
            <PortfolioSummaryCard
              label={
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  Weighted Avg APY
                  <HelpIcon
                    variant="tooltip"
                    content="The portfolio-value-weighted average of all active position APYs."
                  />
                </span>
              }
              value={formatPercent(weightedApy, {
                locale,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              icon={<Percent size={20} color="var(--accent-cyan)" />}
              trend={weightedApyTrend}
              trendPositive={true}
            />
            <PortfolioSummaryCard
              label={t("portfolio.activePositions")}
              value={holdings.filter(h => h.status === 'active').length.toString()}
              icon={<Briefcase size={20} color="var(--text-secondary)" />}
            />
            <PortfolioSummaryCard
              label={
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  Referral Earnings
                  <HelpIcon
                    variant="tooltip"
                    content={t("portfolio.referralTooltip")}
                  />
                </span>
              }
              value={referralStats ? `$${referralStats.total_reward_earned}` : "$0.00"}
              icon={<TrendingUp size={20} color="var(--accent-green)" />}
              trend={referralStats ? `${referralStats.referral_count} referral${referralStats.referral_count !== 1 ? 's' : ''}` : "0 referrals"}
              trendPositive={true}
            />
            <PortfolioSummaryCard
              label={t("portfolio.shareReferralLink")}
              value=""
              icon={<Share2 size={20} color="var(--accent-cyan)" />}
              onClick={() => setShowShareModal(true)}
              clickable={true}
            />
          </div>

          <YieldBreakdownChart totalGain={totalGain} />

          {/* Empty state: wallet connected, loading done, no portfolio value */}
          {!isLoading && totalValue === 0 ? (
            <EmptyState
              kind="no-data"
              title={t("portfolio.noPositions.title")}
              description={t("portfolio.noPositions.desc")}
              icon={<Briefcase />}
              actionLabel={t("portfolio.depositNow")}
              onAction={() => navigate("/")}
            />
          ) : (
          <section
            className="glass-panel"
            style={{ padding: "24px", background: "var(--bg-muted)" }}
            aria-labelledby="holdings-heading"
          >
            <div className="portfolio-toolbar">
              <div>
                <h2 id="holdings-heading" style={{ marginBottom: "6px" }}>Position Details</h2>
                <p className="text-body-sm" style={{ color: "var(--text-secondary)" }}>
                  Sort, search, and page through all current vault positions.
                </p>
              </div>

              <div className="portfolio-toolbar-controls">
                <label className="input-group" style={{ minWidth: "180px" }}>
                  <span className="text-body-sm">Status Filter</span>
                  <div className="input-wrapper">
                    <select
                      className="portfolio-select"
                      value={urlState.filters.status || "all"}
                      onChange={(e) => setFilters({ status: e.target.value })}
                      aria-label="Filter by status"
                    >
                      <option value="all">{t("portfolio.allStatuses")}</option>
                      <option value="active">{t("portfolio.activeStatus")}</option>
                      <option value="pending">{t("portfolio.pendingStatus")}</option>
                    </select>
                  </div>
                </label>

                <label className="input-group" style={{ minWidth: "220px" }}>
                  <span className="text-body-sm">Search positions</span>
                  <div className="input-wrapper">
                    <input
                      className="input-field"
                      type="search"
                      placeholder={t("portfolio.searchPlaceholder")}
                      value={urlState.filters.search || ""}
                      onChange={(event) => setSearch(event.target.value)}
                      style={{ fontSize: "var(--text-base)", fontFamily: "var(--font-sans)" }}
                    />
                  </div>
                </label>

                {(urlState.filters.search || (urlState.filters.status && urlState.filters.status !== "all")) && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={reset}
                    style={{ alignSelf: "flex-end", height: "42px" }}
                  >
                    {t("portfolio.resetFilters")}
                  </button>
                )}
              </div>
            </div>

            <div className="text-body-sm" style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
              {isLoading ? "Loading positions..." : `${totalItems} positions found`}
            </div>

            <DataTable
              caption={t("portfolio.tableCaption")}
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              emptyMessage={holdingsEmptyMessage}
              isLoading={isLoading}
              skeletonRows={state.pageSize}
              sortBy={state.sortBy}
              sortDirection={state.sortDirection}
              onSortChange={setSort}
              pagination={{
                page,
                pageSize: state.pageSize,
                totalItems,
                totalPages,
              }}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              renderRowDetails={(row) => (
                <div className="portfolio-row-meta">
                  <span className={`tag ${row.status === "active" ? "cyan" : ""}`}>
                    {row.status}
                  </span>
                  <span>{row.symbol}</span>
                </div>
              )}
            />
          </section>
          )}
        </div>
      )}

      {referralLink && referralCode && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          referralLink={referralLink}
          referralCode={referralCode}
        />
      )}
    </div>
  );
};

export default Portfolio;
