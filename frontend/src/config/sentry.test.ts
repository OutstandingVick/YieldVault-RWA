import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
// These mocks are hoisted so every fresh import of sentry.ts picks them up.

const mockSentryInit = vi.fn();
const mockSentrySetUser = vi.fn();
const mockSentryCaptureException = vi.fn();
const mockSentryCaptureMessage = vi.fn();
const mockSentryAddBreadcrumb = vi.fn();

vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => mockSentryInit(...args),
  setUser: (...args: unknown[]) => mockSentrySetUser(...args),
  captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
  addBreadcrumb: (...args: unknown[]) => mockSentryAddBreadcrumb(...args),
  reactRouterV6BrowserTracingIntegration: vi.fn(() => ({
    name: "ReactRouterV6BrowserTracing",
  })),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
}));

vi.mock("react-router-dom", () => ({
  useEffect: vi.fn(),
  useLocation: vi.fn(),
  useNavigationType: vi.fn(),
  createRoutesFromChildren: vi.fn(),
  matchRoutes: vi.fn(),
}));

// ---------------------------------------------------------------------------

describe("Sentry configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSentryInit.mockClear();
    mockSentrySetUser.mockClear();
    mockSentryCaptureException.mockClear();
    mockSentryCaptureMessage.mockClear();
    mockSentryAddBreadcrumb.mockClear();
  });

  // -- initSentry -----------------------------------------------------------

  describe("initSentry", () => {
    it("does NOT call Sentry.init when VITE_SENTRY_DSN is absent", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(mockSentryInit).not.toHaveBeenCalled();
      expect(mod.isSentryInitialized()).toBe(false);

      vi.unstubAllEnvs();
    });

    it("calls Sentry.init with a valid DSN", async () => {
      const testDsn = "https://abc123@o0.ingest.sentry.io/12345";
      vi.stubEnv("VITE_SENTRY_DSN", testDsn);

      const mod = await import("./sentry");
      mod.initSentry();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({ dsn: testDsn }),
      );
      expect(mod.isSentryInitialized()).toBe(true);

      vi.unstubAllEnvs();
    });

    it("includes the reactRouterV6BrowserTracingIntegration", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");

      const mod = await import("./sentry");
      mod.initSentry();

      const initArgs = mockSentryInit.mock.calls[0][0] as Record<string, unknown>;
      expect(initArgs.integrations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "ReactRouterV6BrowserTracing" }),
        ]),
      );

      vi.unstubAllEnvs();
    });

    it("includes the replayIntegration", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");

      const mod = await import("./sentry");
      mod.initSentry();

      const initArgs = mockSentryInit.mock.calls[0][0] as Record<string, unknown>;
      expect(initArgs.integrations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Replay" }),
        ]),
      );

      vi.unstubAllEnvs();
    });

    it("uses VITE_SENTRY_ENVIRONMENT when provided", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
      vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "staging");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({ environment: "staging" }),
      );

      vi.unstubAllEnvs();
    });

    it("falls back to MODE when VITE_SENTRY_ENVIRONMENT is absent", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
      // Don't stub VITE_SENTRY_ENVIRONMENT — leave it undefined

      const mod = await import("./sentry");
      mod.initSentry();

      const initArgs = mockSentryInit.mock.calls[0][0] as Record<string, unknown>;
      // environment should be a string (the MODE value, e.g. "test")
      expect(typeof initArgs.environment).toBe("string");
      expect(initArgs.environment).toBeTruthy();

      vi.unstubAllEnvs();
    });

    it("applies custom tracesSampleRate from env", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
      vi.stubEnv("VITE_SENTRY_TRACES_SAMPLE_RATE", "0.5");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({ tracesSampleRate: 0.5 }),
      );

      vi.unstubAllEnvs();
    });
  });

  // -- Helper utilities (Sentry NOT initialized) ----------------------------

  describe("helper utilities when Sentry is not initialized", () => {
    it("captureException is a no-op", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry(); // no-op since DSN is empty

      expect(() => mod.captureException(new Error("test"))).not.toThrow();
      expect(mockSentryCaptureException).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("captureMessage is a no-op", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(() => mod.captureMessage("hello")).not.toThrow();
      expect(mockSentryCaptureMessage).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("setSentryUser is a no-op", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(() => mod.setSentryUser("GSOME...")).not.toThrow();
      expect(mockSentrySetUser).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("addBreadcrumb is a no-op", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(() => mod.addBreadcrumb("event", "wallet")).not.toThrow();
      expect(mockSentryAddBreadcrumb).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("isSentryInitialized returns false", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", "");

      const mod = await import("./sentry");
      mod.initSentry();

      expect(mod.isSentryInitialized()).toBe(false);

      vi.unstubAllEnvs();
    });
  });
});
