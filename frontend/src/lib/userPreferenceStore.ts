/**
 * Versioned, migration-safe localStorage store for chart modes and table density.
 * Wallet-scoped preferences with legacy key migration.
 */

export const PREFERENCE_STORE_VERSION = 1;

export type ChartMode = "line" | "bar" | "area";
export type TableDensity = "compact" | "comfortable" | "spacious";
export type TransactionViewMode = "paginated" | "infinite";

export const CHART_MODE_VALUES: readonly ChartMode[] = ["line", "bar", "area"] as const;
export const TABLE_DENSITY_VALUES: readonly TableDensity[] = [
  "compact",
  "comfortable",
  "spacious",
] as const;

export const TRANSACTION_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type TransactionPageSize = (typeof TRANSACTION_PAGE_SIZE_OPTIONS)[number];

export const TRANSACTION_COLUMN_IDS = [
  "type",
  "status",
  "amount",
  "asset",
  "date",
  "hash",
] as const;
export type TransactionColumnId = (typeof TRANSACTION_COLUMN_IDS)[number];
export type TransactionVisibleColumns = Record<TransactionColumnId, boolean>;

export const DEFAULT_TRANSACTION_VISIBLE_COLUMNS: TransactionVisibleColumns = {
  type: true,
  status: true,
  amount: true,
  asset: true,
  date: true,
  hash: true,
};

export interface ChartModePreferences {
  /** Default visualization mode for vault performance charts */
  vaultPerformance: ChartMode;
  /** Default visualization mode for APY trend charts */
  apyTrend: ChartMode;
  /** Default visualization mode for yield breakdown charts */
  yieldBreakdown: ChartMode;
}

export interface TablePreferences {
  density: TableDensity;
  transactionViewMode: TransactionViewMode;
  transactionPageSize: TransactionPageSize;
  transactionVisibleColumns: TransactionVisibleColumns;
}

export interface UserPreferenceStoreData {
  chartModes: ChartModePreferences;
  tables: TablePreferences;
}

export interface VersionedPreferenceStore {
  version: number;
  data: UserPreferenceStoreData;
}

const STORAGE_KEY_PREFIX = "yieldvault:user-preferences";

/** Legacy keys migrated on first load (issue #730). */
const LEGACY_VIEW_MODE_PREFIX = "yieldvault:transactions:view-mode:";
const LEGACY_PAGE_SIZE_PREFIX = "yieldvault:transactions:page-size:";

export const DEFAULT_CHART_MODES: ChartModePreferences = {
  vaultPerformance: "area",
  apyTrend: "line",
  yieldBreakdown: "line",
};

export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
  density: "comfortable",
  transactionViewMode: "paginated",
  transactionPageSize: 10,
  transactionVisibleColumns: { ...DEFAULT_TRANSACTION_VISIBLE_COLUMNS },
};

export const DEFAULT_USER_PREFERENCE_STORE: UserPreferenceStoreData = {
  chartModes: DEFAULT_CHART_MODES,
  tables: DEFAULT_TABLE_PREFERENCES,
};

function getStorageKey(walletAddress?: string | null): string {
  const walletScope = walletAddress?.trim() ? walletAddress.trim() : "guest";
  return `${STORAGE_KEY_PREFIX}:${walletScope}`;
}

function isChartMode(value: unknown): value is ChartMode {
  return typeof value === "string" && (CHART_MODE_VALUES as readonly string[]).includes(value);
}

function isTableDensity(value: unknown): value is TableDensity {
  return typeof value === "string" && (TABLE_DENSITY_VALUES as readonly string[]).includes(value);
}

function isTransactionViewMode(value: unknown): value is TransactionViewMode {
  return value === "paginated" || value === "infinite";
}

function isTransactionPageSize(value: unknown): value is TransactionPageSize {
  return (
    typeof value === "number" &&
    (TRANSACTION_PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  );
}

function mergeTransactionVisibleColumns(
  partial?: Partial<TransactionVisibleColumns>,
): TransactionVisibleColumns {
  const merged: TransactionVisibleColumns = {
    ...DEFAULT_TRANSACTION_VISIBLE_COLUMNS,
    ...partial,
  };

  for (const id of TRANSACTION_COLUMN_IDS) {
    if (typeof merged[id] !== "boolean") {
      merged[id] = DEFAULT_TRANSACTION_VISIBLE_COLUMNS[id];
    }
  }

  const visibleCount = TRANSACTION_COLUMN_IDS.filter((id) => merged[id]).length;
  if (visibleCount === 0) {
    return { ...DEFAULT_TRANSACTION_VISIBLE_COLUMNS };
  }

  return merged;
}

function parsePageSize(raw: string | null): TransactionPageSize | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return isTransactionPageSize(parsed) ? parsed : undefined;
}

function readLegacyTablePreferences(
  walletAddress?: string | null,
): Partial<TablePreferences> {
  const walletScope = walletAddress?.trim() ? walletAddress.trim() : "guest";
  const legacy: Partial<TablePreferences> = {};

  try {
    const viewModeRaw = localStorage.getItem(`${LEGACY_VIEW_MODE_PREFIX}${walletScope}`);
    if (isTransactionViewMode(viewModeRaw)) {
      legacy.transactionViewMode = viewModeRaw;
    }

    const pageSizeRaw = localStorage.getItem(`${LEGACY_PAGE_SIZE_PREFIX}${walletScope}`);
    const pageSize = parsePageSize(pageSizeRaw);
    if (pageSize !== undefined) {
      legacy.transactionPageSize = pageSize;
    }
  } catch {
    // localStorage unavailable
  }

  return legacy;
}

function removeLegacyTableKeys(walletAddress?: string | null): void {
  const walletScope = walletAddress?.trim() ? walletAddress.trim() : "guest";
  try {
    localStorage.removeItem(`${LEGACY_VIEW_MODE_PREFIX}${walletScope}`);
    localStorage.removeItem(`${LEGACY_PAGE_SIZE_PREFIX}${walletScope}`);
  } catch {
    // localStorage unavailable
  }
}

function mergeChartModes(partial?: Partial<ChartModePreferences>): ChartModePreferences {
  return {
    ...DEFAULT_CHART_MODES,
    ...partial,
    vaultPerformance: isChartMode(partial?.vaultPerformance)
      ? partial.vaultPerformance
      : DEFAULT_CHART_MODES.vaultPerformance,
    apyTrend: isChartMode(partial?.apyTrend)
      ? partial.apyTrend
      : DEFAULT_CHART_MODES.apyTrend,
    yieldBreakdown: isChartMode(partial?.yieldBreakdown)
      ? partial.yieldBreakdown
      : DEFAULT_CHART_MODES.yieldBreakdown,
  };
}

function mergeTablePreferences(
  partial?: Partial<TablePreferences>,
  legacy?: Partial<TablePreferences>,
): TablePreferences {
  const merged = {
    ...DEFAULT_TABLE_PREFERENCES,
    ...legacy,
    ...partial,
  };

  return {
    density: isTableDensity(merged.density) ? merged.density : DEFAULT_TABLE_PREFERENCES.density,
    transactionViewMode: isTransactionViewMode(merged.transactionViewMode)
      ? merged.transactionViewMode
      : DEFAULT_TABLE_PREFERENCES.transactionViewMode,
    transactionPageSize: isTransactionPageSize(merged.transactionPageSize)
      ? merged.transactionPageSize
      : DEFAULT_TABLE_PREFERENCES.transactionPageSize,
    transactionVisibleColumns: mergeTransactionVisibleColumns(
      merged.transactionVisibleColumns,
    ),
  };
}

function normalizeStoreData(
  partial: Partial<UserPreferenceStoreData> | undefined,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  const legacyTables = readLegacyTablePreferences(walletAddress);
  const hasLegacyData =
    legacyTables.transactionViewMode !== undefined ||
    legacyTables.transactionPageSize !== undefined;

  const data: UserPreferenceStoreData = {
    chartModes: mergeChartModes(partial?.chartModes),
    tables: mergeTablePreferences(partial?.tables, legacyTables),
  };

  if (hasLegacyData) {
    removeLegacyTableKeys(walletAddress);
    saveUserPreferenceStore(data, walletAddress);
  }

  return data;
}

function parseVersionedStore(raw: string): Partial<VersionedPreferenceStore> | null {
  try {
    const parsed = JSON.parse(raw) as Partial<VersionedPreferenceStore>;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Load user preferences from localStorage, applying migrations from legacy keys.
 */
export function loadUserPreferenceStore(
  walletAddress?: string | null,
): UserPreferenceStoreData {
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    if (!raw) {
      return normalizeStoreData(undefined, walletAddress);
    }

    const envelope = parseVersionedStore(raw);
    if (!envelope) {
      return normalizeStoreData(undefined, walletAddress);
    }

    // Future versions can branch here; unknown versions fall back safely.
    if (typeof envelope.version === "number" && envelope.version > PREFERENCE_STORE_VERSION) {
      return normalizeStoreData(envelope.data, walletAddress);
    }

    return normalizeStoreData(envelope.data, walletAddress);
  } catch {
    return normalizeStoreData(undefined, walletAddress);
  }
}

/**
 * Persist user preferences with a versioned envelope.
 */
export function saveUserPreferenceStore(
  data: UserPreferenceStoreData,
  walletAddress?: string | null,
): void {
  const envelope: VersionedPreferenceStore = {
    version: PREFERENCE_STORE_VERSION,
    data: {
      chartModes: mergeChartModes(data.chartModes),
      tables: mergeTablePreferences(data.tables),
    },
  };

  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(envelope));
  } catch {
    // storage quota exceeded or unavailable
  }
}

export function updateUserPreferenceStore(
  updater:
    | Partial<UserPreferenceStoreData>
    | ((prev: UserPreferenceStoreData) => UserPreferenceStoreData),
  walletAddress?: string | null,
): UserPreferenceStoreData {
  const current = loadUserPreferenceStore(walletAddress);
  const nextPartial = typeof updater === "function" ? updater(current) : updater;
  const next: UserPreferenceStoreData = {
    chartModes: mergeChartModes({
      ...current.chartModes,
      ...nextPartial.chartModes,
    }),
    tables: mergeTablePreferences({
      ...current.tables,
      ...nextPartial.tables,
    }),
  };
  saveUserPreferenceStore(next, walletAddress);
  return next;
}

export function setChartMode(
  chartKey: keyof ChartModePreferences,
  mode: ChartMode,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => ({
      ...prev,
      chartModes: { ...prev.chartModes, [chartKey]: mode },
    }),
    walletAddress,
  );
}

export function setTableDensity(
  density: TableDensity,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => ({
      ...prev,
      tables: { ...prev.tables, density },
    }),
    walletAddress,
  );
}

export function setTransactionViewMode(
  mode: TransactionViewMode,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => ({
      ...prev,
      tables: { ...prev.tables, transactionViewMode: mode },
    }),
    walletAddress,
  );
}

export function setTransactionPageSize(
  pageSize: TransactionPageSize,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => ({
      ...prev,
      tables: { ...prev.tables, transactionPageSize: pageSize },
    }),
    walletAddress,
  );
}

export function setTransactionVisibleColumns(
  columns: TransactionVisibleColumns,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => ({
      ...prev,
      tables: {
        ...prev.tables,
        transactionVisibleColumns: mergeTransactionVisibleColumns(columns),
      },
    }),
    walletAddress,
  );
}

export function toggleTransactionColumnVisibility(
  columnId: TransactionColumnId,
  walletAddress?: string | null,
): UserPreferenceStoreData {
  return updateUserPreferenceStore(
    (prev) => {
      const current = prev.tables.transactionVisibleColumns;
      const next = mergeTransactionVisibleColumns({
        ...current,
        [columnId]: !current[columnId],
      });
      return {
        ...prev,
        tables: { ...prev.tables, transactionVisibleColumns: next },
      };
    },
    walletAddress,
  );
}

export function resetUserPreferenceStore(
  walletAddress?: string | null,
): UserPreferenceStoreData {
  saveUserPreferenceStore(DEFAULT_USER_PREFERENCE_STORE, walletAddress);
  return { ...DEFAULT_USER_PREFERENCE_STORE };
}

/** @internal Exported for tests */
export function getPreferenceStorageKey(walletAddress?: string | null): string {
  return getStorageKey(walletAddress);
}
