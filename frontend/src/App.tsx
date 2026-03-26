import { useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { VaultProvider } from "./context/VaultContext";
import Navbar from "./components/Navbar";
import "./index.css";

import * as Sentry from "@sentry/react";
import { fetchUsdcBalance } from "./lib/stellarAccount";
import ErrorFallback from "./components/ErrorFallback";
import ViewState from "./components/ViewState";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

// Lazy load route components for code splitting
const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));

const LoadingPage = () => (
  <ViewState
    title="Loading view"
    description="Securing RWA connection and preparing data."
  />
);

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);

  const handleConnect = async (address: string) => {
    setWalletAddress(address);
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setUsdcBalance(0);
  };

  useEffect(() => {
    const loadBalance = async () => {
      if (!walletAddress) {
        setUsdcBalance(0);
        return;
      }

      try {
        const discoveredBalance = await fetchUsdcBalance(walletAddress);
        setUsdcBalance(discoveredBalance);
      } catch {
        setUsdcBalance(0);
      }
    };

    loadBalance();
  }, [walletAddress]);

  const toError = (value: unknown) =>
    value instanceof Error ? value : new Error("Unexpected app error");

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={toError(error)} resetError={resetError} />
      )}
      showDialog
    >
      <ThemeProvider>
        <ToastProvider>
          <VaultProvider>
            <Router>
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <div className="app-shell">
                <Navbar
                  walletAddress={walletAddress}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                <main id="main-content" className="app-main container">
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
                        element={<Portfolio walletAddress={walletAddress} />}
                      />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route
                        path="/transactions"
                        element={
                          <TransactionHistory walletAddress={walletAddress} />
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </SentryRoutes>
                  </Suspense>
                </main>
              </div>
            </Router>
          </VaultProvider>
        </ToastProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
