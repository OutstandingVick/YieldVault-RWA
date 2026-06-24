/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type Page } from '@playwright/test';

// Inline fixture data — avoids JSON import attribute requirements across Node versions
export const vaultSummary = {
  tvl: 12450800,
  depositCap: 15_000_000,
  apy: 8.45,
  participantCount: 1248,
  monthlyGrowthPct: 12.5,
  strategyStabilityPct: 99.9,
  assetLabel: 'Sovereign Debt',
  exchangeRate: 1.084,
  networkFeeEstimate: '~0.00001 XLM',
  updatedAt: '2026-03-25T10:00:00.000Z',
  strategy: {
    id: 'stellar-benji',
    name: 'Franklin BENJI Connector',
    issuer: 'Franklin Templeton',
    network: 'Stellar',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    status: 'active',
    description:
      'Connector strategy that routes vault yield updates from BENJI-issued tokenized money market exposure on Stellar.',
  },
};

/** TVL at deposit cap — drives `isCapReached` in VaultContext (utilization >= 1). */
export const vaultSummaryAtCapacity = {
  ...vaultSummary,
  tvl: vaultSummary.depositCap,
};

const HORIZON_USDC_ISSUER =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQLE2KKWY3NO';

function buildHorizonAccountBody(accountId: string) {
  return JSON.stringify({
    id: accountId,
    account_id: accountId,
    sequence: '12884901882',
    subentry_count: 0,
    balances: [
      { asset_type: 'native', balance: '5.0000000' },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: HORIZON_USDC_ISSUER,
        balance: '1250.5000000',
      },
    ],
    _links: {
      self: { href: `https://horizon-testnet.stellar.org/accounts/${accountId}` },
      transactions: {
        href: `https://horizon-testnet.stellar.org/accounts/${accountId}/transactions{?cursor,limit,order}`,
        templated: true,
      },
      operations: {
        href: `https://horizon-testnet.stellar.org/accounts/${accountId}/operations{?cursor,limit,order}`,
        templated: true,
      },
    },
  });
}

function buildHorizonOperationsBody() {
  return JSON.stringify({
    _embedded: {
      records: [
        {
          id: '12884905984',
          type: 'payment',
          from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          to: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          amount: '100.0000000',
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: HORIZON_USDC_ISSUER,
          created_at: '2026-03-25T10:00:00.000Z',
          transaction_hash:
            'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
        },
      ],
    },
  });
}

const portfolioHoldings = [
  {
    id: 'hold-1',
    asset: 'USDC Treasury Pool',
    vaultName: 'Stellar RWA Yield Fund',
    symbol: 'yvUSDC',
    shares: 1250.5,
    apy: 8.45,
    valueUsd: 1250.5,
    unrealizedGainUsd: 42.15,
    issuer: 'Franklin Templeton',
    status: 'active',
  },
  {
    id: 'hold-2',
    asset: 'Government Bond Basket',
    vaultName: 'Sovereign Income Sleeve',
    symbol: 'yvBOND',
    shares: 840.12,
    apy: 7.2,
    valueUsd: 894.41,
    unrealizedGainUsd: 25.22,
    issuer: 'WisdomTree',
    status: 'active',
  },
  {
    id: 'hold-3',
    asset: 'Short Duration Credit',
    vaultName: 'Liquidity Ladder',
    symbol: 'yvCASH',
    shares: 500.33,
    apy: 6.85,
    valueUsd: 512.9,
    unrealizedGainUsd: 11.48,
    issuer: 'Circle Reserve',
    status: 'pending',
  },
  {
    id: 'hold-4',
    asset: 'Tokenized T-Bills',
    vaultName: 'USD Treasury Express',
    symbol: 'yvUSTB',
    shares: 1380,
    apy: 5.95,
    valueUsd: 1404.32,
    unrealizedGainUsd: 19.77,
    issuer: 'OpenEden',
    status: 'active',
  },
  {
    id: 'hold-5',
    asset: 'Yield Bearing Cash',
    vaultName: 'Prime Reserve Strategy',
    symbol: 'yvPRIME',
    shares: 320.42,
    apy: 7.9,
    valueUsd: 337.08,
    unrealizedGainUsd: 9.66,
    issuer: 'Hashnote',
    status: 'active',
  },
  {
    id: 'hold-6',
    asset: 'EM Debt Blend',
    vaultName: 'Global Carry Vault',
    symbol: 'yvEMD',
    shares: 214.1,
    apy: 9.1,
    valueUsd: 228.55,
    unrealizedGainUsd: 14.07,
    issuer: 'Templeton',
    status: 'pending',
  },
];

/**
 * Intercept mock API routes so tests are fully deterministic.
 */
async function fulfillHorizonRoute(route: import('@playwright/test').Route) {
  if (route.request().method() !== 'GET') {
    await route.continue();
    return;
  }

  const url = route.request().url();

  if (url.includes('/operations')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { date: new Date().toUTCString() },
      body: buildHorizonOperationsBody(),
    });
    return;
  }

  const accountMatch = url.match(/\/accounts\/([^/?]+)/);
  const accountId = accountMatch?.[1] ?? 'unknown';
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { date: new Date().toUTCString() },
    body: buildHorizonAccountBody(accountId),
  });
}

export async function interceptApiRoutes(page: Page) {
  await page.addInitScript(
    ({ issuer, accountBodyTemplate, operationsBody }) => {
      window.localStorage.setItem('hasSeenWalkthrough', 'true');

      const buildAccountBody = (accountId: string) =>
        accountBodyTemplate.replaceAll('__ACCOUNT_ID__', accountId);

      const shouldMockHorizon = (url: string) =>
        url.includes('horizon-testnet.stellar.org') || url.includes('horizon.stellar.org');

      const isHorizonAccount = (url: string) =>
        shouldMockHorizon(url) && url.includes('/accounts/') && !url.includes('/operations');

      const isHorizonOperations = (url: string) =>
        shouldMockHorizon(url) && url.includes('/operations');

      const fulfillJson = (body: string) =>
        new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            Date: new Date().toUTCString(),
          },
        });

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

        if (isHorizonOperations(url)) {
          return fulfillJson(operationsBody);
        }

        if (isHorizonAccount(url)) {
          const accountMatch = url.match(/\/accounts\/([^/?]+)/);
          const accountId = accountMatch?.[1] ?? 'unknown';
          return fulfillJson(buildAccountBody(accountId));
        }

        return originalFetch(input, init);
      };

      const OriginalXHR = window.XMLHttpRequest;
      class HorizonMockXHR extends OriginalXHR {
        private _requestUrl = '';

        open(method: string, url: string | URL, ...rest: unknown[]) {
          this._requestUrl = String(url);
          return super.open(
            method,
            url,
            ...(rest as [boolean, string | null | undefined]),
          );
        }

        send(body?: Document | XMLHttpRequestBodyInit | null) {
          if (isHorizonOperations(this._requestUrl)) {
            queueMicrotask(() => {
              Object.defineProperty(this, 'readyState', { configurable: true, value: 4 });
              Object.defineProperty(this, 'status', { configurable: true, value: 200 });
              Object.defineProperty(this, 'responseText', {
                configurable: true,
                value: operationsBody,
              });
              Object.defineProperty(this, 'response', { configurable: true, value: operationsBody });
              this.dispatchEvent(new Event('readystatechange'));
              this.dispatchEvent(new Event('load'));
            });
            return;
          }

          if (isHorizonAccount(this._requestUrl)) {
            const accountMatch = this._requestUrl.match(/\/accounts\/([^/?]+)/);
            const accountId = accountMatch?.[1] ?? 'unknown';
            const responseBody = buildAccountBody(accountId);
            queueMicrotask(() => {
              Object.defineProperty(this, 'readyState', { configurable: true, value: 4 });
              Object.defineProperty(this, 'status', { configurable: true, value: 200 });
              Object.defineProperty(this, 'responseText', {
                configurable: true,
                value: responseBody,
              });
              Object.defineProperty(this, 'response', { configurable: true, value: responseBody });
              this.dispatchEvent(new Event('readystatechange'));
              this.dispatchEvent(new Event('load'));
            });
            return;
          }

          return super.send(body);
        }
      }

      window.XMLHttpRequest = HorizonMockXHR as typeof XMLHttpRequest;
      void issuer;
    },
    {
      issuer: HORIZON_USDC_ISSUER,
      accountBodyTemplate: buildHorizonAccountBody('__ACCOUNT_ID__'),
      operationsBody: buildHorizonOperationsBody(),
    },
  );

  await page.route('**/mock-api/vault-summary.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vaultSummary),
    }),
  );
  await page.route('**/mock-api/portfolio-holdings.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(portfolioHoldings),
    }),
  );

  await page.route(/horizon(-testnet)?\.stellar\.org/i, fulfillHorizonRoute);
}

/** Wait until the connected wallet banner shows the mocked USDC balance. */
export async function waitForMockUsdcBalance(page: Page) {
  await expect(page.getByLabel('USDC wallet balance')).toContainText('1250.50', {
    timeout: 20_000,
  });
}

/**
 * Stub the Freighter browser extension message protocol.
 *
 * @stellar/freighter-api communicates with the extension via window.postMessage
 * using the source key "FREIGHTER_EXTERNAL_MSG_REQUEST". The extension responds
 * with "FREIGHTER_EXTERNAL_MSG_RESPONSE". We intercept those messages and reply
 * with the appropriate shape so the app believes a wallet is connected.
 *
 * The stub is stateful: call page.evaluate(() => window.__freighterStub.disconnect())
 * to make subsequent isAllowed() calls return false, simulating a real disconnect.
 *
 * This must be injected via addInitScript so it runs before the app bundle.
 */
export async function stubFreighterConnected(page: Page, address: string) {
  await page.addInitScript((addr) => {
    const stub = { connected: true };
    (window as unknown as Record<string, unknown>).__freighterStub = stub;

    window.addEventListener('message', (event) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST'
      ) {
        return;
      }

      const { messageId, type } = event.data as { messageId: number; type: string };

      let response: Record<string, unknown> = {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: messageId,
      };

      switch (type) {
        case 'REQUEST_ALLOWED_STATUS':
        case 'SET_ALLOWED_STATUS':
          response = { ...response, isAllowed: stub.connected };
          break;
        case 'REQUEST_PUBLIC_KEY':
          response = { ...response, publicKey: stub.connected ? addr : '' };
          break;
        case 'REQUEST_ACCESS':
          response = { ...response, publicKey: stub.connected ? addr : '' };
          break;
        case 'REQUEST_CONNECTION_STATUS':
          response = { ...response, isConnected: stub.connected };
          break;
        case 'REQUEST_NETWORK_DETAILS':
          response = {
            ...response,
            networkDetails: {
              network: 'TESTNET',
              networkName: 'Test SDF Network',
              networkUrl: 'https://horizon-testnet.stellar.org',
              networkPassphrase: 'Test SDF Network ; September 2015',
              sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
            },
          };
          break;
        default:
          return;
      }

      window.postMessage(response, window.location.origin);
    });
  }, address);
}

/**
 * Starts disconnected; flips to connected after SET_ALLOWED_STATUS / REQUEST_ACCESS
 * so deposit-flow e2e can exercise the real Connect Freighter button.
 */
export async function stubFreighterManualConnect(page: Page, address: string) {
  await page.addInitScript((addr) => {
    const stub = { connected: false };
    (window as unknown as Record<string, unknown>).__freighterStub = stub;

    window.addEventListener('message', (event) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST'
      ) {
        return;
      }

      const { messageId, type } = event.data as { messageId: number; type: string };

      let response: Record<string, unknown> = {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: messageId,
      };

      switch (type) {
        case 'SET_ALLOWED_STATUS':
        case 'REQUEST_ACCESS':
          stub.connected = true;
          response = { ...response, isAllowed: true, publicKey: addr };
          break;
        case 'REQUEST_ALLOWED_STATUS':
          response = { ...response, isAllowed: stub.connected };
          break;
        case 'REQUEST_PUBLIC_KEY':
          response = { ...response, publicKey: stub.connected ? addr : '' };
          break;
        case 'REQUEST_CONNECTION_STATUS':
          response = { ...response, isConnected: stub.connected };
          break;
        case 'REQUEST_NETWORK_DETAILS':
          response = {
            ...response,
            networkDetails: {
              network: 'TESTNET',
              networkName: 'Test SDF Network',
              networkUrl: 'https://horizon-testnet.stellar.org',
              networkPassphrase: 'Test SDF Network ; September 2015',
              sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
            },
          };
          break;
        default:
          return;
      }

      window.postMessage(response, window.location.origin);
    });
  }, address);
}

export async function stubFreighterDisconnected(page: Page) {
  await page.addInitScript(() => {
    const stub = { connected: false };
    (window as unknown as Record<string, unknown>).__freighterStub = stub;

    window.addEventListener("message", (event) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST"
      ) {
        return;
      }

      const { messageId, type } = event.data as { messageId: number; type: string };

      let response: Record<string, unknown> = {
        source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
        messagedId: messageId,
      };

      switch (type) {
        case "REQUEST_ALLOWED_STATUS":
        case "SET_ALLOWED_STATUS":
          response = { ...response, isAllowed: false };
          break;
        case "REQUEST_PUBLIC_KEY":
        case "REQUEST_ACCESS":
          response = { ...response, publicKey: "" };
          break;
        case "REQUEST_CONNECTION_STATUS":
          response = { ...response, isConnected: false };
          break;
        case "REQUEST_NETWORK_DETAILS":
          response = {
            ...response,
            networkDetails: {
              network: "TESTNET",
              networkName: "Test SDF Network",
              networkUrl: "https://horizon-testnet.stellar.org",
              networkPassphrase: "Test SDF Network ; September 2015",
              sorobanRpcUrl: "https://soroban-testnet.stellar.org",
            },
          };
          break;
        default:
          return;
      }

      window.postMessage(response, window.location.origin);
    });
  });
}

type Fixtures = {
  /** Page with API routes intercepted — no wallet connected */
  appPage: Page;
};

export const test = base.extend<Fixtures>({
  appPage: async ({ page }, use) => {
    await interceptApiRoutes(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
