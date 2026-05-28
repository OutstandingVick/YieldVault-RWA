# Frontend Observability with Sentry

This project uses [Sentry](https://sentry.io) for real-time error tracking, performance monitoring (Web Vitals), and session replay.

---

## Quick Start

1. **Create a Sentry project** at [sentry.io](https://sentry.io).
2. **Get your DSN** from *Project Settings → Client Keys (DSN)*.
3. **Set environment variables** in your `.env.local` file:

```env
# Required: enables error monitoring
VITE_SENTRY_DSN=https://your-public-key@o0.ingest.sentry.io/project-id

# Required for source-map uploads during builds
SENTRY_AUTH_TOKEN=your_auth_token_here

# Optional overrides (defaults shown)
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_TRACES_SAMPLE_RATE=1.0
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

> **Security:** Never commit real DSN values or auth tokens. They are already in `.gitignore`.

---

## Architecture

### Initialization (`src/config/sentry.ts`)

```
main.tsx
  └─ initSentry()          ← called once at startup before React renders
       └─ Sentry.init()    ← conditional on VITE_SENTRY_DSN being set
```

`initSentry()` is a no-op when `VITE_SENTRY_DSN` is absent, so local dev works without Sentry configured.

### Error Boundary (`src/App.tsx`)

The root `<Sentry.ErrorBoundary>` wraps the entire application:

```tsx
<Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
  <App />
</Sentry.ErrorBoundary>
```

This automatically captures and reports any unhandled React render errors.

### Router Integration (`src/App.tsx`)

```ts
const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);
```

Wrapping `Routes` with Sentry allows per-route performance tracing.

---

## What is Tracked?

| Event | Mechanism |
|---|---|
| **Unhandled exceptions** | `Sentry.ErrorBoundary` in `App.tsx` |
| **Manual errors** | `captureException()` helper in `config/sentry.ts` |
| **Log messages** | `captureMessage()` helper in `config/sentry.ts` |
| **Page-load Web Vitals** | `reactRouterV6BrowserTracingIntegration` |
| **Route transitions** | `withSentryReactRouterV6Routing` wrapper |
| **Session Replays** | `replayIntegration` (10 % of sessions; 100 % on error) |
| **Connected wallet** | `setSentryUser()` call after wallet connect |

---

## Helper Utilities

Import from `src/config/sentry.ts`:

```ts
import {
  captureException,
  captureMessage,
  setSentryUser,
  addBreadcrumb,
  isSentryInitialized,
} from "./config/sentry";

// Capture an unexpected error with optional context
captureException(err, { module: "vault-deposit" });

// Log an informational event
captureMessage("Vault deposit initiated", "info", { amount: 100 });

// Identify the user after wallet connect
setSentryUser(walletAddress);        // set
setSentryUser(null);                 // clear on disconnect

// Add a navigation/action breadcrumb
addBreadcrumb("User clicked deposit", "ui.click", { txHash });

// Check if Sentry was initialized (useful in tests)
isSentryInitialized();               // boolean
```

All helpers are **safe to call when Sentry is not initialised** — they no-op silently.

---

## Source Maps & Release Tracking

The `@sentry/vite-plugin` in `vite.config.ts` automatically:

- Uploads source maps on `npm run build`
- Tags releases with the version string

Set `SENTRY_AUTH_TOKEN` (a *Sentry Internal Integration* token with `project:releases` and `org:read` scopes) before building for production.

---

## Sample Rates (Production Recommendations)

| Variable | Development | Staging | Production |
|---|---|---|---|
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | `1.0` | `0.25` | `0.1` |
| `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | `0.1` | `0.1` | `0.05` |
| `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | `1.0` | `1.0` | `1.0` |

See `.env.production.example` for a ready-to-use production configuration.

---

## Privacy

- All text and form inputs in Session Replays are **masked by default** (`maskAllText: true`).
- Sensitive query-string parameters (`key`, `token`, `secret`) are stripped from breadcrumb URLs via the `beforeBreadcrumb` hook.
- Wallet addresses are used only as opaque Sentry user IDs — no PII is attached.
