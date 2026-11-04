import { test, expect } from '@playwright/test';
import { ShopPage } from './pages/ShopPage.js';

test.describe('Shop', () => {
  test('loads the shop page', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/shop/);
  });

  test('renders product data seeded for E2E', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    // Network idle can hang if the embed/polling APIs stay open; use a visible
    // heading that only renders after products load ("Shop All Products").
    await expect(
      page.getByRole('heading', { name: /shop all products/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test('renders an "Add to Cart" button on products', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    // Products are seeded by globalSetup, so at least one Add to Cart button
    // must render on the shop page.
    const addButtons = page.getByRole('button', { name: /add .* to cart/i });
    await expect(addButtons.first()).toBeVisible({ timeout: 15000 });
  });
});

// The filter UI is desktop-only in the sidebar; on small screens it lives in a
// sticky "Filters" bar that opens a bottom sheet. Guard the breakpoint split,
// the sheet's dialog semantics, and that active filters surface on the button.
test.describe('Mobile filter bottom sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens from the sticky bar, applies a filter, counts and closes via Escape', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();

    // Sidebar is desktop-only; the sticky bar drives filters on mobile.
    await expect(page.getByRole('heading', { name: /filter by/i })).toBeHidden();
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await expect(filtersButton).toBeVisible();

    await filtersButton.click();
    const sheet = page.getByRole('dialog', { name: /filters/i });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal', 'true');

    // Filters apply immediately, so the count badge appears on the trigger.
    await sheet.getByLabel('Fruits').check();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(filtersButton).toHaveText(/1/);
    // Escape returns focus to the trigger that opened the sheet.
    await expect(filtersButton).toBeFocused();
  });
});

test.describe('Desktop filters', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows the sidebar and hides the mobile filter bar', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.goto();
    await expect(page.getByRole('heading', { name: /filter by/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: /filters/i })).toBeHidden();
  });
});
