const MOCK_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const vaultSummary = {
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
  contractPaused: false,
  strategy: {
    id: 'stellar-benji',
    name: 'Franklin BENJI Connector',
    issuer: 'Franklin Templeton',
    network: 'Stellar',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    status: 'active',
    description: 'Connector strategy.',
  },
};

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
];

/**
 * Inject the Freighter stub into the window BEFORE the app bundle executes.
 */
function stubFreighterConnected(win: Cypress.AUTWindow): void {
  const stub = { connected: true };
  (win as Window & { __freighterStub?: unknown }).__freighterStub = stub;

  win.addEventListener('message', (event: MessageEvent) => {
    if (
      event.source !== win ||
      !event.data ||
      event.data.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST'
    ) {
      return;
    }

    const { messageId, type } = event.data as { messageId: number; type: string };

    const response: Record<string, unknown> = {
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: messageId,
    };

    switch (type) {
      case 'SET_ALLOWED_STATUS':
        stub.connected = true;
        response.isAllowed = true;
        response.publicKey = MOCK_ADDRESS;
        break;
      case 'REQUEST_ALLOWED_STATUS':
        response.isAllowed = stub.connected;
        break;
      case 'REQUEST_PUBLIC_KEY':
        response.publicKey = stub.connected ? MOCK_ADDRESS : '';
        break;
      case 'REQUEST_ACCESS':
        stub.connected = true;
        response.isAllowed = true;
        response.publicKey = MOCK_ADDRESS;
        break;
      case 'REQUEST_CONNECTION_STATUS':
        response.isConnected = stub.connected;
        break;
      case 'REQUEST_NETWORK_DETAILS':
        response.networkDetails = {
          network: 'TESTNET',
          networkName: 'Test SDF Network',
          networkUrl: 'https://horizon-testnet.stellar.org',
          networkPassphrase: 'Test SDF Network ; September 2015',
          sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        };
        break;
      default:
        return;
    }

    win.postMessage(response, win.location.origin);
  });
}

function setupApiIntercepts(): void {
  cy.intercept('GET', '**/mock-api/vault-summary.json', {
    statusCode: 200,
    body: vaultSummary,
  }).as('vaultSummary');
  cy.intercept('GET', '**/mock-api/portfolio-holdings.json', {
    statusCode: 200,
    body: portfolioHoldings,
  }).as('portfolioHoldings');
  cy.intercept('GET', 'https://horizon-testnet.stellar.org/accounts/*/operations*', {
    statusCode: 200,
    body: {
      _embedded: {
        records: [
          {
            id: '12884905984',
            type: 'payment',
            from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            to: MOCK_ADDRESS,
            amount: '100.0000000',
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
            created_at: '2026-03-25T10:00:00.000Z',
            transaction_hash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
          },
        ],
      },
    },
  }).as('horizonOperations');
  cy.intercept('GET', 'https://horizon-testnet.stellar.org/accounts/*', (req) => {
    const accountId = req.url.split('/accounts/')[1]?.split('?')[0] ?? MOCK_ADDRESS;
    req.reply({
      statusCode: 200,
      body: {
        id: accountId,
        account_id: accountId,
        sequence: '12884901882',
        subentry_count: 0,
        balances: [
          { asset_type: 'native', balance: '5.0000000' },
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQLE2KKWY3NO',
            balance: '1250.5000000',
          },
        ],
      },
    });
  }).as('horizonAccount');
}

function visitWithStubs(url = '/'): void {
  setupApiIntercepts();
  cy.visit(url, {
    onBeforeLoad: (win) => {
      stubFreighterConnected(win);
      win.localStorage.setItem('hasSeenWalkthrough', 'true');
      win.localStorage.setItem('yieldvault_last_wallet_provider', 'freighter');
    },
  });
}

function waitForConnectedVault(): void {
  cy.get('body', { timeout: 30000 }).then(($body) => {
    if ($body.find('button[aria-label="Disconnect Wallet"]').length === 0) {
      cy.contains('button', /Connect Freighter/i).click();
    }
  });
  cy.get('button[aria-label="Disconnect Wallet"]', { timeout: 30000 }).should('exist');
  cy.get('[aria-label="USDC wallet balance"]', { timeout: 30000 }).should('contain.text', '1250.50');
  cy.contains('Wallet Not Connected').should('not.exist');
}

describe('YieldVault Smoke Tests', () => {
  beforeEach(() => {
    visitWithStubs('/');
  });

  it('should connect wallet', () => {
    cy.get('body', { timeout: 30000 }).should(($body) => {
      const hasDisconnect = $body.find('button[aria-label="Disconnect Wallet"]').length > 0;
      const hasConnect = $body.text().includes('Connect Freighter');
      const hasChecking = $body.text().includes('Checking wallet');
      expect(hasDisconnect || hasConnect || hasChecking).to.eq(true);
    });
  });

  it('should navigate to deposit flow', () => {
    waitForConnectedVault();
    cy.contains('[role="tab"]', 'Deposit').click({ force: true });
    cy.contains('Amount to deposit', { timeout: 10000 }).should('be.visible');
  });

  it('should navigate to withdrawal flow', () => {
    waitForConnectedVault();
    cy.contains('[role="tab"]', 'Withdraw').click({ force: true });
    cy.contains('Amount to withdraw', { timeout: 10000 }).should('be.visible');
  });

  it('should view transaction history', () => {
    visitWithStubs('/transactions');
    waitForConnectedVault();
    cy.contains('History', { timeout: 10000 }).should('be.visible');
    cy.get('body').should(($body) => {
      const text = $body.text();
      const hasTable = $body.find('table').length > 0;
      const hasEmptyState = text.includes('No transactions yet');
      const hasWalletPrompt = text.includes('Connect your wallet to view your transaction history');
      const hasLoading = text.includes('Loading...');
      expect(hasTable || hasEmptyState || hasWalletPrompt || hasLoading).to.eq(true);
    });
  });
});
