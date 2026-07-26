/**
 * Core flow: Settings
 *
 * Covers the settings preference surface (reachable via /settings deep link / shortcut).
 */
import { test, expect, interceptApiRoutes } from './fixtures';

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApiRoutes(page);
  });

  test('renders settings and toggles dark theme preference', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Appearance')).toBeVisible();

    const darkOption = page.getByRole('button', { name: /^Dark$/i });
    await expect(darkOption).toBeVisible();
    await darkOption.click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', /dark/i);
  });
});
