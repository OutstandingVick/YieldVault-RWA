import React, { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import * as Sentry from "@sentry/react";
import Navbar from "./components/Navbar";
import { KeyboardShortcutProvider } from "./context/KeyboardShortcutContext";
import ShortcutHelpModal from "./components/ShortcutHelpModal";
import { FeatureGate } from "./components/FeatureGate";
import { FeatureFlagProvider } from "./context/FeatureFlagContext";
import { useTranslation } from "./i18n";
import { useUsdcBalance } from "./hooks/useBalanceData";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));
const UIPreview = lazy(() => import("./pages/UIPreview"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const Settings = lazy(() => import("./pages/Settings"));
const LoadingPage = () => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "60vh",
        color: "var(--accent-cyan)",
        fontSize: "1.2rem",
        fontWeight: 500,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="text-gradient"
          style={{ fontSize: "2rem", marginBottom: "16px" }}
        >
          {t("app.loading.title")}
        </div>
        <div style={{ opacity: 0.6 }}>{t("app.loading.subtitle")}</div>
      </div>
    </div>
  );
};

const AppErrorFallback = () => {
  const { t } = useTranslation();
  return <p>{t("app.errorBoundary")}</p>;
};

function AppContent() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { data: usdcBalance = 0 } = useUsdcBalance(walletAddress);

  const handleConnect = (address: string) => {
    setWalletAddress(address);
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
  };


  return (
    <KeyboardShortcutProvider>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-container">
        <Navbar
          walletAddress={walletAddress}
          usdcBalance={usdcBalance}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        <main id="main-content" className="container app-main" style={{ marginTop: "100px", paddingBottom: "60px" }}>
          <Suspense fallback={<LoadingPage />}>
            <SentryRoutes>
              <Route
                path="/"
                element={
                  <Home
                    walletAddress={walletAddress}
                    usdcBalance={usdcBalance}
                  />
                }
              />
              <Route
                path="/portfolio"
                element={
                  <Portfolio
                    walletAddress={walletAddress}
                    usdcBalance={usdcBalance}
                  />
                }
              />
              <Route
                path="/analytics"
                element={
                  <FeatureGate flag="ANALYTICS_PAGE">
                    <Analytics />
                  </FeatureGate>
                }
              />
              <Route path="/transactions" element={<TransactionHistory walletAddress={walletAddress} />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ui-kit" element={<UIPreview />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </SentryRoutes>
          </Suspense>
        </main>
        <ShortcutHelpModal />
      </div>
    </KeyboardShortcutProvider>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog>
      <FeatureFlagProvider>
        <AppContent />
      </FeatureFlagProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
