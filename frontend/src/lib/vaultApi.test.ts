import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account } from "@stellar/stellar-sdk";
import {
  decodeSharePrice,
  getSharePrice,
  SharePriceFetchError,
} from "./vaultApi";

const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const VALID_ACCOUNT_ID = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const { mockNetworkConfig, simulateTransaction, getAccount } = vi.hoisted(() => ({
  mockNetworkConfig: {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  simulateTransaction: vi.fn(),
  getAccount: vi.fn(),
}));

vi.mock("../config/network", () => ({
  networkConfig: mockNetworkConfig,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: class MockRpcServer {
        getAccount = getAccount;
        simulateTransaction = simulateTransaction;
      },
    },
  };
});

function mockI128ReturnValue(value: bigint) {
  const lo = value & ((1n << 64n) - 1n);
  const hi = value >> 64n;

  return {
    i128: () => ({
      hi: () => ({ toString: () => hi.toString() }),
      lo: () => ({ toString: () => lo.toString() }),
    }),
  };
}

describe("decodeSharePrice", () => {
  it("decodes 1:1 share price", () => {
    expect(decodeSharePrice(1_000_000_000_000_000_000n)).toBe(1);
  });

  it("decodes fractional share price", () => {
    expect(decodeSharePrice(1_084_200_000_000_000_000n)).toBeCloseTo(1.0842, 4);
  });

  it("decodes zero", () => {
    expect(decodeSharePrice(0n)).toBe(0);
  });
});

describe("getSharePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNetworkConfig.contractId = VALID_CONTRACT_ID;
    getAccount.mockResolvedValue(new Account(VALID_ACCOUNT_ID, "0"));
  });

  it("throws SharePriceFetchError when contract ID is empty", async () => {
    mockNetworkConfig.contractId = "";

    await expect(getSharePrice()).rejects.toBeInstanceOf(SharePriceFetchError);
    expect(simulateTransaction).not.toHaveBeenCalled();
  });

  it("returns decoded share price from simulation", async () => {
    simulateTransaction.mockResolvedValue({
      result: {
        retval: mockI128ReturnValue(1_000_000_000_000_000_000n),
      },
    });

    await expect(getSharePrice()).resolves.toBe(1);
    expect(simulateTransaction).toHaveBeenCalledOnce();
  });

  it("wraps RPC failures in SharePriceFetchError", async () => {
    const rpcError = new Error("network timeout");
    simulateTransaction.mockRejectedValue(rpcError);

    await expect(getSharePrice()).rejects.toMatchObject({
      name: "SharePriceFetchError",
      cause: rpcError,
    });
  });

  it("throws SharePriceFetchError on simulation errors", async () => {
    simulateTransaction.mockResolvedValue({
      error: "contract not found",
    });

    await expect(getSharePrice()).rejects.toBeInstanceOf(SharePriceFetchError);
  });

  it("throws SharePriceFetchError when contract returns no value", async () => {
    simulateTransaction.mockResolvedValue({
      result: {},
    });

    await expect(getSharePrice()).rejects.toThrow("Contract returned no value");
  });
});
