import { test, expect } from '@playwright/test';

test.describe('Cart', () => {
  test('redirects guests to login on the protected cart page', async ({ page }) => {
    await page.goto('/cart');
    // /cart is behind ProtectedRoute, so an unauthenticated visitor is
    // redirected to /login.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});

// Regression tests now live on the server side:
// server/__tests__/regression/routes.test.js
// They run faster and more reliably via Jest + Supertest without a browser.
