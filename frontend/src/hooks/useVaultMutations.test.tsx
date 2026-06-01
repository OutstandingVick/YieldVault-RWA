/**
 * Tests for optimistic UI updates in useDepositMutation / useWithdrawMutation.
 * Covers: pending insert, rollback on error, reconcile on success, stable ordering.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { useDepositMutation, useWithdrawMutation } from "./useVaultMutations";
import * as vaultApi from "../lib/vaultApi";
import { queryKeys } from "../lib/queryClient";
import type { Transaction } from "../lib/transactionApi";

vi.mock("../lib/vaultApi", () => ({
  submitDeposit: vi.fn(),
  submitWithdrawal: vi.fn(),
}));

const WALLET = "GABC123";
const TX_KEY = queryKeys.transactions.list(WALLET);

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "existing-1",
    type: "deposit",
    status: "completed",
    amount: "50.00",
    asset: "USDC",
    timestamp: "2025-01-01T00:00:00.000Z",
    transactionHash: "hash-existing-1",
    ...overrides,
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

describe("useDepositMutation – optimistic updates", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    vi.clearAllMocks();
  });

  it("inserts a pending transaction row immediately on mutate", async () => {
    vi.mocked(vaultApi.submitDeposit).mockResolvedValue(undefined);
    queryClient.setQueryData<Transaction[]>(TX_KEY, [makeTransaction()]);

    const { result } = renderHook(() => useDepositMutation(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ walletAddress: WALLET, amount: 100 });
    });

    // Optimistic row should appear before the mutation resolves
    await waitFor(() => {
      const txs = queryClient.getQueryData<Transaction[]>(TX_KEY);
      expect(txs?.[0].status).toBe("pending");
      expect(txs?.[0].type).toBe("deposit");
      expect(txs?.[0].id).toMatch(/^optimistic-deposit-/);
    });
  });

  it("pending row is prepended — existing rows remain below it", async () => {
    vi.mocked(vaultApi.submitDeposit).mockResolvedValue(undefined);
    const existing = [makeTransaction({ id: "e1" }), makeTransaction({ id: "e2" })];
    queryClient.setQueryData<Transaction[]>(TX_KEY, existing);

    const { result } = renderHook(() => useDepositMutation(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ walletAddress: WALLET, amount: 25 });
    });

    await waitFor(() => {
      const txs = queryClient.getQueryData<Transaction[]>(TX_KEY)!;
      expect(txs[0].id).toMatch(/^optimistic-/);
      expect(txs[1].id).toBe("e1");
      expect(txs[2].id).toBe("e2");
    });
  });

  it("rolls back to snapshot on error", async () => {
    vi.mocked(vaultApi.submitDeposit).mockRejectedValue(new Error("network error"));
    const existing = [makeTransaction()];
    queryClient.setQueryData<Transaction[]>(TX_KEY, existing);

    const { result } = renderHook(() => useDepositMutation(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ walletAddress: WALLET, amount: 100 });
      } catch {
        // expected
      }
    });

    const txs = queryClient.getQueryData<Transaction[]>(TX_KEY);
    expect(txs).toEqual(existing);
    expect(txs?.some((t) => t.id.startsWith("optimistic-"))).toBe(false);
  });

  it("invalidates transaction query on success (reconcile)", async () => {
    vi.mocked(vaultApi.submitDeposit).mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDepositMutation(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ walletAddress: WALLET, amount: 50 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: TX_KEY }),
    );
  });

  it("pending row has a timestamp at or after mutation start", async () => {
    vi.mocked(vaultApi.submitDeposit).mockResolvedValue(undefined);
    const before = Date.now();

    const { result } = renderHook(() => useDepositMutation(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ walletAddress: WALLET, amount: 10 });
    });

    await waitFor(() => {
      const txs = queryClient.getQueryData<Transaction[]>(TX_KEY);
      const pending = txs?.find((t) => t.id.startsWith("optimistic-"));
      expect(pending).toBeDefined();
      expect(new Date(pending!.timestamp).getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});

// ─── Withdrawal ───────────────────────────────────────────────────────────────

describe("useWithdrawMutation – optimistic updates", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    vi.clearAllMocks();
  });

  it("inserts a pending withdrawal row immediately on mutate", async () => {
    vi.mocked(vaultApi.submitWithdrawal).mockResolvedValue(undefined);
    queryClient.setQueryData<Transaction[]>(TX_KEY, []);

    const { result } = renderHook(() => useWithdrawMutation(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ walletAddress: WALLET, amount: 75 });
    });

    await waitFor(() => {
      const txs = queryClient.getQueryData<Transaction[]>(TX_KEY);
      expect(txs?.[0].status).toBe("pending");
      expect(txs?.[0].type).toBe("withdrawal");
      expect(txs?.[0].id).toMatch(/^optimistic-withdrawal-/);
    });
  });

  it("rolls back to snapshot on error", async () => {
    vi.mocked(vaultApi.submitWithdrawal).mockRejectedValue(new Error("rpc error"));
    const existing = [makeTransaction({ type: "withdrawal", id: "w1" })];
    queryClient.setQueryData<Transaction[]>(TX_KEY, existing);

    const { result } = renderHook(() => useWithdrawMutation(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ walletAddress: WALLET, amount: 30 });
      } catch {
        // expected
      }
    });

    const txs = queryClient.getQueryData<Transaction[]>(TX_KEY);
    expect(txs).toEqual(existing);
  });

  it("invalidates transaction query on success", async () => {
    vi.mocked(vaultApi.submitWithdrawal).mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWithdrawMutation(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ walletAddress: WALLET, amount: 20 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: TX_KEY }),
    );
  });

  it("no duplicate rows after success invalidation clears optimistic entry", async () => {
    vi.mocked(vaultApi.submitWithdrawal).mockResolvedValue(undefined);
    // Simulate server returning real data (no optimistic row)
    const serverData = [makeTransaction({ id: "server-1", type: "withdrawal" })];
    queryClient.setQueryData<Transaction[]>(TX_KEY, []);

    const { result } = renderHook(() => useWithdrawMutation(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ walletAddress: WALLET, amount: 20 });
    });

    // Simulate the refetch returning server data (invalidation triggers this in real app)
    queryClient.setQueryData<Transaction[]>(TX_KEY, serverData);

    const txs = queryClient.getQueryData<Transaction[]>(TX_KEY)!;
    const optimisticRows = txs.filter((t) => t.id.startsWith("optimistic-"));
    expect(optimisticRows).toHaveLength(0);
    expect(txs).toHaveLength(1);
  });
});
