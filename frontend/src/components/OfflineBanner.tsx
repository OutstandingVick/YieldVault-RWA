import { useEffect, useState, useCallback } from "react";
import { queryClient } from "../lib/queryClient";

interface OfflineBannerProps {
  lastKnownTvl?: number;
  lastKnownBalance?: number;
}

type BannerState = "hidden" | "offline" | "online_success";

export default function OfflineBanner({ lastKnownTvl, lastKnownBalance }: OfflineBannerProps) {
  const [bannerState, setBannerState] = useState<BannerState>(
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "hidden"
  );

  useEffect(() => {
    let timeoutId: number;

    const handleOnline = () => {
      // Transition to success state immediately
      setBannerState("online_success");
      
      // Instantly trigger fresh HTTP requests for all active dashboard widgets
      queryClient.invalidateQueries();

      // Auto-fade out after 3-5 seconds
      timeoutId = window.setTimeout(() => {
        setBannerState("hidden");
      }, 4000);
    };

    const handleOffline = () => {
      window.clearTimeout(timeoutId);
      setBannerState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerState === "online_success") {
      setBannerState("hidden");
    }
  }, [bannerState]);

  if (bannerState === "hidden") return null;

  const isOffline = bannerState === "offline";

  return (
    <div 
      className={`offline-banner ${isOffline ? "offline-banner--error" : "offline-banner--success"}`} 
      role="alert" 
      aria-live="assertive"
    >
      <div className="offline-banner__content flex justify-between items-center">
        <div className="flex items-center gap-sm">
          <span className="offline-banner__icon" aria-hidden="true">
            {isOffline ? "⚠️" : "✅"}
          </span>
          <span>
            {isOffline 
              ? "You are currently offline. Attempting to reconnect..." 
              : "Connection restored! Updating dashboard..."}
          </span>
          {isOffline && (lastKnownTvl !== undefined || lastKnownBalance !== undefined) && (
            <span className="offline-banner__data">
              {lastKnownTvl !== undefined && `TVL: $${lastKnownTvl.toLocaleString()}`}
              {lastKnownTvl !== undefined && lastKnownBalance !== undefined && " · "}
              {lastKnownBalance !== undefined && `Balance: ${lastKnownBalance.toFixed(2)} USDC`}
            </span>
          )}
        </div>
        {!isOffline && (
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
