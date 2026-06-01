import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OfflineBanner from "./OfflineBanner";
import { queryClient } from "../lib/queryClient";

vi.mock("../lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

describe("OfflineBanner", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const setOnline = (value: boolean) => {
    Object.defineProperty(navigator, 'onLine', {
      value,
      configurable: true,
    });
  };

  it("should hide by default when online", () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should show offline banner when offline event fires", () => {
    setOnline(true);
    render(<OfflineBanner />);
    
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); // Non-dismissible
  });

  it("should show success banner and invalidate queries on online event, then auto-dismiss", () => {
    setOnline(false);
    render(<OfflineBanner />);
    
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    // Should show success banner
    expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();
    
    // Should invalidate queries
    expect(queryClient.invalidateQueries).toHaveBeenCalled();

    // Should be dismissible manually
    const dismissBtn = screen.getByRole("button", { name: /Dismiss banner/i });
    expect(dismissBtn).toBeInTheDocument();

    // Auto dismiss after 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
  });

  it("can be manually dismissed when online_success", () => {
    setOnline(false);
    render(<OfflineBanner />);
    
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    const dismissBtn = screen.getByRole("button", { name: /Dismiss banner/i });
    act(() => {
      dismissBtn.click();
    });

    expect(screen.queryByText(/Connection restored/i)).not.toBeInTheDocument();
  });
});
