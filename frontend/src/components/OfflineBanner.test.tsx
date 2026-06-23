import { render, screen, act, waitFor } from "@testing-library/react";
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
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    render(<OfflineBanner />);

    await waitFor(() => {
      expect(screen.getByText(/retrying in 5s/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should have role status and aria-live polite when retrying", async () => {
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    render(<OfflineBanner />);

    const banner = await screen.findByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveAttribute("aria-atomic", "true");
  });

  it("should show success banner when transitioning from offline to online", async () => {
    vi.useRealTimers();
    // Start offline
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { rerender } = render(<OfflineBanner />);
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

    // Transition to online (simulate reconnection)
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it("should have role status and aria-live polite for success message", async () => {
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { rerender } = render(<OfflineBanner />);
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);

    const banner = await screen.findByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("should show dismissible button only on success state", async () => {
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { rerender } = render(<OfflineBanner />);
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);

    const dismissBtn = await screen.findByRole("button", { name: /Dismiss banner/i });
    expect(dismissBtn).toBeInTheDocument();
  });

  it("should auto-dismiss success message after 4 seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { rerender } = render(<OfflineBanner />);
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
  });

  it("should manually dismiss success message", async () => {
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { rerender } = render(<OfflineBanner />);
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);

    const dismissBtn = await screen.findByRole("button", { name: /Dismiss banner/i });
    act(() => {
      dismissBtn.click();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
    });
  });

  it("should update countdown when secondsUntilRetry changes", async () => {
    vi.useRealTimers();
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    const { rerender } = render(<OfflineBanner />);

    await waitFor(() => {
      expect(screen.getByText(/retrying in 5s/i)).toBeInTheDocument();
    });

    // Update countdown
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 3 });
    rerender(<OfflineBanner />);

    await waitFor(() => {
      expect(screen.getByText(/retrying in 3s/i)).toBeInTheDocument();
    });
  });

  it("should not render when hidden (online, not retrying, not recently reconnected)", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    const { container } = render(<OfflineBanner />);

    // The component will not render the banner initially since there's no transition
    expect(container.firstChild).toBeNull();
  });

  it("should use correct icons for each state", async () => {
    vi.useRealTimers();
    // Offline state - warning icon
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { container: offlineContainer, unmount } = render(<OfflineBanner />);
    expect(offlineContainer.textContent).toContain("⚠️");
    unmount();

    // Retrying state - spinner icon
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: true, secondsUntilRetry: 5 });
    const { container: retryingContainer, unmount: unmountRetrying } = render(<OfflineBanner />);
    await waitFor(() => {
      expect(retryingContainer.textContent).toContain("🔄");
    });
    unmountRetrying();

    // Success state - check mark icon
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: false });
    const { container: successContainer, rerender } = render(<OfflineBanner />);
    vi.mocked(useNetworkStatus).mockReturnValue({ isOnline: true });
    vi.mocked(useRetryState).mockReturnValue({ isRetrying: false, secondsUntilRetry: null });
    rerender(<OfflineBanner />);
    await waitFor(() => {
      expect(successContainer.textContent).toContain("✅");
    });
  });
});
