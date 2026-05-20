import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.espn.com/');
  await page.getByRole('link', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Menu' }).click();
  await page.getByRole('heading', { name: 'NBA', exact: true }).click();
  await page.locator('#leagues').getByText('Gamecast').click();
  await page.getByRole('link', { name: 'ESPN Soccer Home Page' }).click();
  await page.getByRole('link', { name: 'World Cup ' }).click();
  await page.getByRole('link', { name: 'Schedule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'FIFA World Cup Schedule' })).toBeVisible();
});