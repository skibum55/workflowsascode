import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://nexuscoreai.azurewebsites.net/LoginPage?ReturnUrl=%2F');
  await page.getByRole('textbox', { name: 'User Name' }).click();
  await page.getByRole('textbox', { name: 'User Name' }).fill('Amy Jackson');
  await page.getByRole('textbox', { name: 'User Name' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('AmyJackson');
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await page.getByRole('textbox', { name: 'Describe your issue, request' }).click();
  await page.getByRole('textbox', { name: 'Describe your issue, request' }).fill('printer queue is full');
  await page.getByRole('textbox', { name: 'Describe your issue, request' }).press('Enter');
  await page.locator('div').filter({ hasText: 'Northstar AI SupportActive' }).nth(3).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Print Job Fails or Gets Stuck' }).click();
  const page1 = await page1Promise;
});