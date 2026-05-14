import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.yahoo.com/');
  await page.getByRole('searchbox', { name: 'Search query' }).click();
  await page.getByRole('searchbox', { name: 'Search query' }).click();
  await page.getByRole('searchbox', { name: 'Search query' }).fill('g');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('searchbox', { name: 'Search query' }).press('Enter');
  const page1 = await page1Promise;
});