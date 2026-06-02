import { useState, useEffect } from "react";

/**
 * Hook that tracks the browser's online/offline status.
 * Subscribes to 'online' and 'offline' window events and initializes with navigator.onLine.
 *
 * @returns {{ isOnline: boolean }} The current online status
 *
 * @example
 * ```tsx
 * const { isOnline } = useNetworkStatus();
 * if (!isOnline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" && navigator.onLine
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
