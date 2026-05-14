import { test, expect } from '@playwright/test';

test('verto login', async ({ page }) => {
  await page.goto('https://nexuscoreai.azurewebsites.net/LoginPage');
  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();

  // await page.getByRole('textbox', { name: 'User Name' }).click();
  await page.getByRole('textbox', { name: 'User Name' }).fill('user');
  // await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Password123');
  await page.getByRole('button', { name: 'Log In' }).click();
});