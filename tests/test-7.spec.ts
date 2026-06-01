import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://nexuscoreai.azurewebsites.net/LoginPage?ReturnUrl=%2F');
  await page.getByRole('textbox', { name: 'User Name' }).fill('skeery');
  await page.getByRole('textbox', { name: 'Password' }).fill('Password123');
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await page.goto('https://nexuscoreai.azurewebsites.net/Approval_ListView');
  await expect(page.getByRole('button', { name: 'skeery' })).toBeVisible();
  await page.getByRole('gridcell', { name: 'DEMO123456-Computer Request-' }).nth(1).click();
  await page.getByRole('link', { name: 'Justin Ostos' }).click();
  await expect(page.getByRole('textbox', { name: 'First Name*' })).toHaveValue('Justin');
  await expect(page.getByRole('textbox', { name: 'Employee ID*' })).toHaveValue('2100671');
});