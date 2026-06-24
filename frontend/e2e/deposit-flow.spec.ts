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
} from './fixtures';

const MOCK_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SHORT_ADDR = `${MOCK_ADDRESS.substring(0, 5)}...${MOCK_ADDRESS.substring(MOCK_ADDRESS.length - 4)}`;

test.describe('Deposit flow (e2e)', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApiRoutes(page);
    await stubFreighterManualConnect(page, MOCK_ADDRESS);
  });

  test('connects wallet and deposits USDC successfully', async ({ page }) => {
    await page.goto('/');

    // Starts disconnected
    await expect(page.getByText('Wallet Not Connected')).toBeVisible();

    // Connect via the real UI button (drives setAllowed -> isAllowed -> getAddress)
    await page.getByRole('button', { name: /Connect Freighter/i }).click();
    await expect(page.getByText(SHORT_ADDR)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Wallet Not Connected')).not.toBeVisible();
    await waitForMockUsdcBalance(page);

    const amountInput = page.getByLabel('Deposit amount');
    await amountInput.fill('100');

    const reviewBtn = page.getByRole('button', { name: /Review Transaction/i });
    await expect(reviewBtn).toBeEnabled();
    await reviewBtn.click();

    const confirmBtn = page.getByRole('button', { name: /Confirm deposit/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page.getByText('Transaction Successful')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Done/i }).click();
    await expect(reviewBtn).toBeVisible();
    await expect(amountInput).not.toHaveValue('100');
  });
});
