import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import * as Sentry from "@sentry/react";
import Navbar from "./components/Navbar";
import ErrorFallback from "./components/ErrorFallback";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { VaultProvider } from "./context/VaultContext";
import { fetchUsdcBalance } from "./lib/stellarAccount";
import "./index.css";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));

const LoadingPage = () => (
  <div className="loading-page" role="status" aria-live="polite">
    <div style={{ textAlign: "center" }}>
      <div className="text-gradient loading-title">Loading...</div>
      <div style={{ opacity: 0.7 }}>Securing RWA connection</div>
    </div>
  </div>
);

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);

  const handleConnect = (address: string) => {
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
        setUsdcBalance(await fetchUsdcBalance(walletAddress));
      } catch {
        setUsdcBalance(0);
      }
    };

    void loadBalance();
  }, [walletAddress]);

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error as Error} resetError={resetError} />
      )}
      showDialog
    >
      <ThemeProvider>
        <ToastProvider>
          <VaultProvider>
            <Router>
              <a className="skip-link" href="#main-content">
                Skip to main content
              </a>
              <div className="app-container">
                <Navbar
                  walletAddress={walletAddress}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                <main id="main-content" className="container app-main">
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
                        element={<TransactionHistory walletAddress={walletAddress} />}
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
