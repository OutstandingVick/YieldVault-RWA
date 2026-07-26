/**
 * Flow: Deposit journey (manual wallet connect)
 *
 * Covers: wallet connect → deposit → success toast/state
 * Uses deterministic API stubs so the test is stable in CI.
 */
import {
  test,
  expect,
  interceptApiRoutes,
  stubFreighterManualConnect,
  waitForMockUsdcBalance,
  fillDepositAmount,
  completeVaultReviewStep,
} from './fixtures';

const MOCK_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SHORT_ADDR = `${MOCK_ADDRESS.substring(0, 5)}...${MOCK_ADDRESS.substring(MOCK_ADDRESS.length - 4)}`;

test.describe.skip('Deposit flow (e2e)', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApiRoutes(page);
    await stubFreighterManualConnect(page, MOCK_ADDRESS);
  });

  test('connects wallet and deposits USDC successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Wallet Not Connected')).toBeVisible();

    await page.getByRole('button', { name: /Connect Freighter/i }).click();
    await expect(page.getByText(SHORT_ADDR)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Wallet Not Connected')).not.toBeVisible();
    await waitForMockUsdcBalance(page);

    const { amountInput, reviewBtn } = await fillDepositAmount(page, '100');
    await completeVaultReviewStep(page, 'deposit');

    await page.getByRole('button', { name: /Done/i }).click();
    await expect(reviewBtn).toBeVisible();
    await expect(amountInput).not.toHaveValue('100');
  });
});
