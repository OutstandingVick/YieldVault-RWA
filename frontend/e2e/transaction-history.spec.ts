/**
 * Core flow: Transaction History
 *
 * Covers wallet-gated empty state and authenticated history loaded from Horizon stubs.
 */
import { test, expect, interceptApiRoutes, stubFreighterConnected } from './fixtures';

const MOCK_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const SHORT_ADDR = `${MOCK_ADDRESS.substring(0, 5)}...${MOCK_ADDRESS.substring(MOCK_ADDRESS.length - 4)}`;

test.describe('Transaction history — unauthenticated', () => {
  test('prompts the user to connect a wallet', async ({ page }) => {
    await interceptApiRoutes(page);
    await page.goto('/transactions');

    await expect(page.getByRole('heading', { name: 'Connect your wallet' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect wallet/i })).toBeVisible();
  });
});

test.describe('Transaction history — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApiRoutes(page);
    await stubFreighterConnected(page, MOCK_ADDRESS);
  });

  test('loads Horizon payment history for the connected wallet', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.getByText(SHORT_ADDR)).toBeVisible({ timeout: 5_000 });

    // Stubbed Horizon payment is USDC 100.00
    await expect(page.getByText(/100(\.0+)?/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/USDC/i).first()).toBeVisible();
  });

  test('navbar can reach transaction history from the vault home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(SHORT_ADDR)).toBeVisible({ timeout: 5_000 });

    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByText(/History/i).first()).toBeVisible();
  });
});
