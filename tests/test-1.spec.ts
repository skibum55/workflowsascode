import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.nba.com/');
  await page.getByRole('link', { name: '12:00 AM UTC Game 5: Series' }).click();
  await page.getByRole('link', { name: 'Fantasy' }).click();
  await page.getByRole('link', { name: 'Draft' }).click();
  await expect(page.getByText('2026 NBA Draft', { exact: true })).toBeVisible();
  await expect(page.locator('#nav-ul')).toContainText('Chicago Bulls');
});