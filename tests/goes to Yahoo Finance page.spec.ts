import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.yahoo.com/');
  await page.locator('#ybar-l1-nav').getByRole('link', { name: 'Finance' }).click();
  await page.goto('https://finance.yahoo.com/');
  await page.getByRole('link', { name: 'Finance', exact: true }).click();
});