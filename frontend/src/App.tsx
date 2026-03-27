import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { VaultProvider } from "./context/VaultContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import SessionExpiredModal from "./components/SessionExpiredModal";
import "./index.css";

import * as Sentry from "@sentry/react";
import { fetchUsdcBalance } from "./lib/stellarAccount";
import { createApiClient } from "./lib/api";
import ErrorFallback from "./components/ErrorFallback";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

// Lazy load route components for code splitting
const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));

// Loading component for Suspense fallback
const LoadingPage = () => (
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
        Loading...
      </div>
      <div style={{ opacity: 0.6 }}>Securing RWA connection</div>
    </div>
  </div>
);

/**
 * Inner app shell — has access to AuthContext and Router context.
 * Registers the 401/403 error interceptor once and conditionally
 * renders SessionExpiredModal.
 */
function AppShell({
  walletAddress,
  usdcBalance,
  onConnect,
  onDisconnect,
}: {
  walletAddress: string | null;
  usdcBalance: number;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}) {
  const { sessionState, intendedPath, setSessionExpired, clearSessionExpired } =
    useAuth();
  const location = useLocation();
  // Stable ref to avoid re-registering the interceptor on every render
  const interceptorRegistered = useRef(false);

  useEffect(() => {
    if (interceptorRegistered.current) return;
    interceptorRegistered.current = true;

    // Create a shared client instance used for interceptor registration.
    // Individual API modules create their own clients; this interceptor is
    // attached to the global singleton exported from api/index.
    const client = createApiClient();
    const unsubscribe = client.useError((error) => {
      if (error.code === "AUTH_ERROR") {
        setSessionExpired(location.pathname);
      }
      return error;
    });

    return () => {
      unsubscribe();
      interceptorRegistered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReconnect = async () => {
    // Trigger wallet reconnect; on success clear expired state
    // Optional: navigate to intendedPath after reconnect
    try {
      const { setAllowed } = await import("@stellar/freighter-api");
      const { discoverConnectedAddress } = await import("./lib/stellarAccount");
      await setAllowed();
      const discoveredAddress = await discoverConnectedAddress();
      if (discoveredAddress) {
        onConnect(discoveredAddress);
        clearSessionExpired();
      }
    } catch {
      // Wallet errors are surfaced by WalletConnect; silently ignore here
    }
  };

  const handleDismiss = () => {
    clearSessionExpired();
    // Navigate home to avoid stale protected views
    window.location.href = "/";
  };

  return (
    <div className="app-container">
      <Navbar
        walletAddress={walletAddress}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
      <main className="container" style={{ marginTop: "100px", paddingBottom: "60px" }}>
        <Suspense fallback={<LoadingPage />}>
          <SentryRoutes>
            <Route
              path="/"
              element={<Home walletAddress={walletAddress} usdcBalance={usdcBalance} />}
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

      {sessionState === "expired" && (
        <SessionExpiredModal
          intendedPath={intendedPath}
          onReconnect={handleReconnect}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);

  const handleConnect = useCallback(async (address: string) => {
    setWalletAddress(address);
  }, []);

  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    setUsdcBalance(0);
  }, []);

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

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      showDialog
    >
      <ThemeProvider>
        <ToastProvider>
          <VaultProvider>
            <AuthProvider>
              <Router>
                <AppShell
                  walletAddress={walletAddress}
                  usdcBalance={usdcBalance}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              </Router>
            </AuthProvider>
          </VaultProvider>
        </ToastProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
