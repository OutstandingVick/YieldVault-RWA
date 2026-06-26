/**
 * YieldVault API Pagination Consumer Example (TypeScript)
 *
 * Demonstrates deterministic cursor-based paging against list endpoints such as:
 * - GET /api/transactions
 * - GET /api/portfolio/holdings
 * - GET /api/vault/history
 *
 * Features:
 * - Cursor-forward iteration with no duplicate IDs across pages
 * - Stable replay of the first page for the same query parameters
 * - Graceful handling of invalid or expired cursors
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3000 npx ts-node docs/examples/api_pagination_consumer.ts
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

interface PaginationMeta {
  count: number;
  limit: number;
  total: number | null;
  nextCursor: string | null;
  prevCursor: string | null;
  currentPage: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  asset: string;
  timestamp: string;
  transactionHash: string;
  walletAddress: string;
}

type QueryParams = Record<string, string | number | undefined>;

function buildUrl(path: string, params: QueryParams = {}): string {
  const url = new URL(path, API_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchPage<T>(
  path: string,
  params: QueryParams = {},
): Promise<PaginatedResponse<T>> {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as PaginatedResponse<T>;
}

/**
 * Walk every page using nextCursor until hasNextPage is false.
 * Returns all collected IDs so callers can verify there are no duplicates.
 */
export async function fetchAllWithCursor<T extends { id: string }>(
  path: string,
  params: QueryParams = {},
): Promise<{ items: T[]; ids: string[] }> {
  const items: T[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const page = await fetchPage<T>(path, {
      ...params,
      ...(cursor ? { cursor } : {}),
    });

    for (const item of page.data) {
      if (seenIds.has(item.id)) {
        throw new Error(`Duplicate item detected while paging: ${item.id}`);
      }
      seenIds.add(item.id);
      items.push(item);
    }

    if (!page.pagination.hasNextPage || !page.pagination.nextCursor) {
      break;
    }

    cursor = page.pagination.nextCursor;
  }

  return { items, ids: [...seenIds] };
}

/**
 * Prove deterministic behavior: two identical first-page requests return the same IDs.
 */
export async function assertDeterministicFirstPage(
  path: string,
  params: QueryParams = {},
): Promise<void> {
  const first = await fetchPage<{ id: string }>(path, params);
  const second = await fetchPage<{ id: string }>(path, params);

  const firstIds = first.data.map((item) => item.id);
  const secondIds = second.data.map((item) => item.id);

  if (JSON.stringify(firstIds) !== JSON.stringify(secondIds)) {
    throw new Error("First page ordering changed between identical requests");
  }
}

/**
 * Demonstrate cursor usage on /api/transactions with a small page size.
 */
export async function demonstrateTransactionPaging(limit = 5): Promise<void> {
  console.log(`\n=== Cursor paging demo (limit=${limit}) ===`);

  const page1 = await fetchPage<Transaction>("/api/transactions", { limit });
  console.log("Page 1 IDs:", page1.data.map((tx) => tx.id).join(", "));
  console.log("nextCursor:", page1.pagination.nextCursor ?? "(none)");
  console.log("hasNextPage:", page1.pagination.hasNextPage);

  if (!page1.pagination.nextCursor) {
    console.log("No additional pages available.");
    return;
  }

  const page2 = await fetchPage<Transaction>("/api/transactions", {
    limit,
    cursor: page1.pagination.nextCursor,
  });
  console.log("Page 2 IDs:", page2.data.map((tx) => tx.id).join(", "));

  const overlap = page1.data.filter((tx) => page2.data.some((other) => other.id === tx.id));
  if (overlap.length > 0) {
    throw new Error(`Pages overlapped: ${overlap.map((tx) => tx.id).join(", ")}`);
  }

  console.log("No overlap between page 1 and page 2.");
}

async function main(): Promise<void> {
  console.log(`Using API base URL: ${API_BASE_URL}`);

  await assertDeterministicFirstPage("/api/transactions", { limit: 5 });
  console.log("Deterministic first-page check passed.");

  await demonstrateTransactionPaging(5);

  const { ids, items } = await fetchAllWithCursor<Transaction>("/api/transactions", {
    limit: 20,
  });
  console.log(`Fetched ${items.length} transactions across all pages (${ids.length} unique IDs).`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
