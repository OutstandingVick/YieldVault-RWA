import { useEffect, useState, useCallback } from "react";
import { queryClient } from "../lib/queryClient";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useRetryState } from "../hooks/useRetryState";

interface OfflineBannerProps {
  lastKnownTvl?: number;
  lastKnownBalance?: number;
}

type BannerState = "hidden" | "offline" | "retrying" | "online_success";

/**
 * OfflineBanner component displays connectivity state and retry information.
 * - Offline state: Shows warning when device is disconnected (non-dismissible)
 * - Retrying state: Shows countdown to next retry attempt when queries are retrying
 * - Success state: Brief success message that auto-dismisses after 3-4 seconds
 * - Hidden state: Not rendered
 *
 * Accessibility:
 * - Uses role="alert" for offline (high urgency) and role="status" for retrying/success
 * - Uses aria-live="assertive" for offline and "polite" for retrying/success
 * - Countdown is screen-reader accessible via aria-live region updates
 *
 * @param lastKnownTvl - Last known TVL to display while offline
 * @param lastKnownBalance - Last known balance to display while offline
 */
export default function OfflineBanner({ lastKnownTvl, lastKnownBalance }: OfflineBannerProps) {
  const { isOnline } = useNetworkStatus();
  const { isRetrying, secondsUntilRetry } = useRetryState();
  
  const [bannerState, setBannerState] = useState<BannerState>(
    !isOnline ? "offline" : "hidden"
  );

  useEffect(() => {
    let timeoutId: number;

    if (!isOnline) {
      // Device went offline
      window.clearTimeout(timeoutId);
      setBannerState("offline");
    } else if (isRetrying) {
      // Online but queries are retrying
      setBannerState("retrying");
    } else if (bannerState === "offline") {
      // Transitioned from offline to online
      setBannerState("online_success");
      
      // Instantly trigger fresh HTTP requests for all active dashboard widgets
      queryClient.invalidateQueries();

      // Auto-fade out after 4 seconds
      timeoutId = window.setTimeout(() => {
        setBannerState("hidden");
      }, 4000);
    } else if (bannerState === "online_success" && !isRetrying) {
      // Continue showing success state if retrying ended
      timeoutId = window.setTimeout(() => {
        setBannerState("hidden");
      }, 4000);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOnline, isRetrying, bannerState]);

  const dismissBanner = useCallback(() => {
    if (bannerState === "online_success") {
      setBannerState("hidden");
    }
  }, [bannerState]);

  if (bannerState === "hidden") return null;

  const isOffline = bannerState === "offline";
  const isSuccess = bannerState === "online_success";
  const showRetrying = bannerState === "retrying";

  return (
    <div 
      className={`offline-banner ${
        isOffline 
          ? "offline-banner--error" 
          : isSuccess 
          ? "offline-banner--success" 
          : "offline-banner--retrying"
      }`} 
      role={isOffline ? "alert" : "status"}
      aria-live={isOffline ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="offline-banner__content flex justify-between items-center">
        <div className="flex items-center gap-sm">
          <span className="offline-banner__icon" aria-hidden="true">
            {isOffline ? "⚠️" : isSuccess ? "✅" : "🔄"}
          </span>
          <span>
            {isOffline 
              ? "You are offline. Polling is paused."
              : isSuccess
              ? "Connection restored! Updating dashboard..."
              : showRetrying && secondsUntilRetry !== null
              ? `Reconnecting… retrying in ${secondsUntilRetry}s`
              : "Reconnecting…"
            }
          </span>
          {isOffline && (lastKnownTvl !== undefined || lastKnownBalance !== undefined) && (
            <span className="offline-banner__data">
              {lastKnownTvl !== undefined && `TVL: $${lastKnownTvl.toLocaleString()}`}
              {lastKnownTvl !== undefined && lastKnownBalance !== undefined && " · "}
              {lastKnownBalance !== undefined && `Balance: ${lastKnownBalance.toFixed(2)} USDC`}
            </span>
          )}
        </div>
        {isSuccess && (
          <button 
            type="button" 
            className="offline-banner__dismiss"
            onClick={dismissBanner}
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
