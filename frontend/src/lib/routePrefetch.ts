import { lazy } from "react";

export const routeImports = {
  "/": () => import("../pages/Home"),
  "/portfolio": () => import("../pages/Portfolio"),
  "/analytics": () => import("../pages/Analytics"),
  "/transactions": () => import("../pages/TransactionHistory"),
  "/settings": () => import("../pages/Settings"),
  "/ui-kit": () => import("../pages/UIPreview"),
} as const;

export type PrefetchableRoute = keyof typeof routeImports;

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(path: PrefetchableRoute): void {
  if (prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);
  void routeImports[path]();
}

export function prefetchDashboardRoutes(excludePath?: string): void {
  const primaryRoutes: PrefetchableRoute[] = [
    "/",
    "/portfolio",
    "/analytics",
    "/transactions",
  ];

  for (const path of primaryRoutes) {
    if (path !== excludePath) {
      prefetchRoute(path);
    }
  }
}

export function getRoutePrefetchHandlers(path: PrefetchableRoute) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
  };
}

export const LazyHome = lazy(routeImports["/"]);
export const LazyPortfolio = lazy(routeImports["/portfolio"]);
export const LazyAnalytics = lazy(routeImports["/analytics"]);
export const LazyTransactionHistory = lazy(routeImports["/transactions"]);
export const LazySettings = lazy(routeImports["/settings"]);
export const LazyUIPreview = lazy(routeImports["/ui-kit"]);
