import { useState, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { VaultProvider } from "./context/VaultContext";
import Navbar from "./components/Navbar";
import { useTranslation } from "./i18n";
import "./index.css";

import * as Sentry from "@sentry/react";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

// Lazy load route components for code splitting
const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));

function AppLoadingFallback() {
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
}

function AppErrorFallback() {
  const { t } = useTranslation();
  return <p>{t("app.errorBoundary")}</p>;
}

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnect = async (address: string) => {
    setWalletAddress(address);
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
  };

  return (
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog>
      <ThemeProvider>
        <VaultProvider>
          <Router>
            <div className="app-container">
              <Navbar
                walletAddress={walletAddress}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
              <main
                className="container"
                style={{ marginTop: "100px", paddingBottom: "60px" }}
              >
                <Suspense fallback={<AppLoadingFallback />}>
                  {/* Replaced Routes with SentryRoutes to capture performance events */}
                  <SentryRoutes>
                    <Route
                      path="/"
                      element={<Home walletAddress={walletAddress} />}
                    />
                    <Route
                      path="/portfolio"
                      element={<Portfolio walletAddress={walletAddress} />}
                    />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </SentryRoutes>
                </Suspense>
              </main>
            </div>
          </Router>
        </VaultProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
