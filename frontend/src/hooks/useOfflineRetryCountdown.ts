import { useState, useEffect } from "react";

/**
 * A hook that tracks offline status and provides a simulated countdown timer.
 * This reassures the user that the application is actively waiting or "retrying"
 * to connect while the network is down.
 */
export function useOfflineRetryCountdown(initialCountdown = 5) {
  const [countdown, setCountdown] = useState(initialCountdown);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      setCountdown(initialCountdown);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initialCountdown]);

  useEffect(() => {
    if (!isOffline) return;

    const id = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : initialCountdown));
    }, 1000);

    return () => clearInterval(id);
  }, [isOffline, initialCountdown]);

  return { isOffline, countdown };
}
