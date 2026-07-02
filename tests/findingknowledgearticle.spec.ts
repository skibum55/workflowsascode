import { test, expect } from '@playwright/test';

test('finding a knowledge article', {tag: ['@PRP123', '@KMS', '@positive']}, async ({ page }) => {
  await page.goto('https://nexuscoreai.azurewebsites.net');
  await page.getByRole('textbox', { name: 'User Name' }).fill('Amy Jackson');
  await page.getByRole('textbox', { name: 'Password' }).fill('AmyJackson');
  await page.getByRole('button', { name: 'Log In' }).press('Enter');
  await page.getByRole('textbox', { name: 'Describe what you need help' }).fill('printer queue full');
  await page.getByRole('button', { name: 'Ask Verto' }).press('Enter');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Print Job Fails or Gets Stuck' }).click();
  const page1 = await page1Promise;
});