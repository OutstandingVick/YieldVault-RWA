import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

/** True after Sentry.init() has been successfully called. */
let _sentryInitialized = false;

export const isSentryInitialized = (): boolean => _sentryInitialized;

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (!dsn) {
    console.warn("[Sentry] DSN not configured. Error monitoring is disabled.");
    return;
  }

  const isProd = import.meta.env.PROD;

  // Allow env-level overrides for sample rates (useful for staging/production tuning).
  const tracesSampleRate = parseFloat(
    (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string) ?? (isProd ? "0.1" : "1.0"),
  );
  const replaysSessionSampleRate = parseFloat(
    (import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE as string) ?? "0.1",
  );
  const replaysOnErrorSampleRate = parseFloat(
    (import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE as string) ?? "1.0",
  );

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        // Mask all text and inputs by default for privacy
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate,
    // Only propagate to our own API endpoints
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/api\.yieldvault\.finance/,
    ],
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    // Don't send errors in development unless DSN is explicitly set
    enabled: isProd || Boolean(dsn),
    // Strip PII from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
        // Remove sensitive query params from URLs
        if (breadcrumb.data?.url) {
          try {
            const url = new URL(breadcrumb.data.url as string);
            url.searchParams.delete("key");
            url.searchParams.delete("token");
            url.searchParams.delete("secret");
            breadcrumb.data.url = url.toString();
          } catch {
            // Relative URL — leave as-is
          }
        }
      }
      return breadcrumb;
    },
  });

  _sentryInitialized = true;
};

/**
 * Capture an exception and send it to Sentry.
 * Safe to call even when Sentry is not initialized — it no-ops gracefully.
 */
export const captureException = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  if (!_sentryInitialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

/**
 * Capture a message-level event in Sentry.
 * Safe to call even when Sentry is not initialized — it no-ops gracefully.
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, unknown>,
): void => {
  if (!_sentryInitialized) return;
  Sentry.captureMessage(message, { level, extra: context });
};

/**
 * Identify the currently connected wallet address as the Sentry user.
 * Call this after a wallet connect event.
 */
export const setSentryUser = (walletAddress: string | null): void => {
  if (!_sentryInitialized) return;
  if (walletAddress) {
    Sentry.setUser({ id: walletAddress });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * Add a Sentry breadcrumb for important application events.
 */
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>,
): void => {
  if (!_sentryInitialized) return;
  Sentry.addBreadcrumb({ message, category, data, level: "info" });
};
