import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OfflineBanner from "./OfflineBanner";
import { queryClient } from "../lib/queryClient";

vi.mock("../lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

// Mock the hooks
vi.mock("../hooks/useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(),
}));

vi.mock("../hooks/useRetryState", () => ({
  useRetryState: vi.fn(),
}));

import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useRetryState } from "../hooks/useRetryState";

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderOnlineSuccessBanner() {
  vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
  const view = render(<OfflineBanner />);
  expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

  vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
  vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
  view.rerender(<OfflineBanner />);
  await flushMicrotasks();

  return view;
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default mocks
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should hide by default when online and not retrying", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should show offline banner when offline", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    render(<OfflineBanner />);

    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Offline banner should NOT be dismissible
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should have role alert and aria-live assertive when offline", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    render(<OfflineBanner />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveAttribute("aria-atomic", "true");
  });

  it("should display offline message with last known data", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    render(<OfflineBanner lastKnownTvl={1000000} lastKnownBalance={100} />);

    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
    expect(screen.getByText(/TVL:.*1,000,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Balance:.*100/i)).toBeInTheDocument();
  });

  it("should show retrying state with countdown when retrying", async () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    render(<OfflineBanner />);
    await flushMicrotasks();

    expect(screen.getByText(/Reconnecting.*retrying in 5s/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should have role status and aria-live polite when retrying", async () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    render(<OfflineBanner />);
    await flushMicrotasks();

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveAttribute("aria-atomic", "true");
  });

  it("should show success banner when transitioning from offline to online", async () => {
    await renderOnlineSuccessBanner();

    expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it("should have role status and aria-live polite for success message", async () => {
    await renderOnlineSuccessBanner();

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("should show dismissible button only on success state", async () => {
    await renderOnlineSuccessBanner();

    const dismissBtn = screen.getByRole("button", { name: /Dismiss banner/i });
    expect(dismissBtn).toBeInTheDocument();
  });

  it("should auto-dismiss success message after 4 seconds", async () => {
    await renderOnlineSuccessBanner();

    expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
  });

  it("should manually dismiss success message", async () => {
    await renderOnlineSuccessBanner();

    const dismissBtn = screen.getByRole("button", { name: /Dismiss banner/i });
    act(() => {
      dismissBtn.click();
    });

    expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
  });

  it("should update countdown when secondsUntilRetry changes", async () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    const { rerender } = render(<OfflineBanner />);
    await flushMicrotasks();

    expect(screen.getByText(/retrying in 5s/i)).toBeInTheDocument();

    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 3 });
    rerender(<OfflineBanner />);
    await flushMicrotasks();

    expect(screen.getByText(/retrying in 3s/i)).toBeInTheDocument();
  });

  it("should not render when hidden (online, not retrying, not recently reconnected)", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    const { container } = render(<OfflineBanner />);

    expect(container.firstChild).toBeNull();
  });

  it("should use correct icons for each state", async () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { container: offlineContainer, unmount: unmountOffline } = render(<OfflineBanner />);
    expect(offlineContainer.textContent).toContain("⚠️");
    unmountOffline();

    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    const { container: retryingContainer, unmount: unmountRetrying } = render(<OfflineBanner />);
    await flushMicrotasks();
    expect(retryingContainer.textContent).toContain("🔄");
    unmountRetrying();

    await renderOnlineSuccessBanner();
    expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();
    expect(document.body.textContent).toContain("✅");
  });
});
