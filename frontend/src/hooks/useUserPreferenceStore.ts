import { useCallback, useEffect, useState } from "react";
import {
  type ChartMode,
  type ChartModePreferences,
  type TableDensity,
  type TransactionPageSize,
  type TransactionViewMode,
  type UserPreferenceStoreData,
  loadUserPreferenceStore,
  resetUserPreferenceStore,
  setChartMode as persistChartMode,
  setTableDensity as persistTableDensity,
  setTransactionPageSize as persistTransactionPageSize,
  setTransactionViewMode as persistTransactionViewMode,
  updateUserPreferenceStore,
} from "../lib/userPreferenceStore";

export function useUserPreferenceStore(walletAddress?: string | null) {
  const [store, setStore] = useState<UserPreferenceStoreData>(() =>
    loadUserPreferenceStore(walletAddress),
  );

  useEffect(() => {
    queueMicrotask(() => setStore(loadUserPreferenceStore(walletAddress)));
  }, [walletAddress]);

  const setChartMode = useCallback(
    (chartKey: keyof ChartModePreferences, mode: ChartMode) => {
      setStore(persistChartMode(chartKey, mode, walletAddress));
    },
    [walletAddress],
  );

  const setTableDensity = useCallback(
    (density: TableDensity) => {
      setStore(persistTableDensity(density, walletAddress));
    },
    [walletAddress],
  );

  const setTransactionViewMode = useCallback(
    (mode: TransactionViewMode) => {
      setStore(persistTransactionViewMode(mode, walletAddress));
    },
    [walletAddress],
  );

  const setTransactionPageSize = useCallback(
    (pageSize: TransactionPageSize) => {
      setStore(persistTransactionPageSize(pageSize, walletAddress));
    },
    [walletAddress],
  );

  const updateStore = useCallback(
    (
      updater:
        | Partial<UserPreferenceStoreData>
        | ((prev: UserPreferenceStoreData) => UserPreferenceStoreData),
    ) => {
      setStore(updateUserPreferenceStore(updater, walletAddress));
    },
    [walletAddress],
  );

  const resetStore = useCallback(() => {
    setStore(resetUserPreferenceStore(walletAddress));
  }, [walletAddress]);

  return {
    store,
    chartModes: store.chartModes,
    tables: store.tables,
    setChartMode,
    setTableDensity,
    setTransactionViewMode,
    setTransactionPageSize,
    updateStore,
    resetStore,
  };
}
