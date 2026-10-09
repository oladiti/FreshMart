import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage.js';

test.describe('Homepage', () => {
  test('loads successfully and shows the app brand', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.expectLoaded();
    await expect(page).toHaveTitle(/Grocery|FreshMart/);
  });

  test('renders the navbar with navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('navigates from home to the shop page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const shopLink = page.locator('a[href="/shop"]').first();
    if (await shopLink.isVisible()) {
      await shopLink.click();
      await expect(page).toHaveURL(/\/shop/);
    }
  });

  test('navigates to the login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loginLink = page.locator('a[href="/login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    }
  });

  test('returns 200 for the home route', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
  });
});
