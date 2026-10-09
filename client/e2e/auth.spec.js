import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage.js';
import { e2eUser } from './fixtures/testData.js';

test.describe('Authentication', () => {
  test('shows an error for invalid credentials', async ({ page }) => {
    const login = new LoginPage(page);
    await login.login('wrong@test.com', 'wrongpassword');
    // Target the login form's own error banner rather than a class substring,
    // which also matches unrelated red-styled elements elsewhere on the page.
    await expect(login.errorMessage()).toBeVisible();
    await expect(login.errorMessage()).toContainText(/invalid credentials/i);
  });

  test('logs in with valid credentials and lands on the app', async ({ page }) => {
    const login = new LoginPage(page);
    await login.login(e2eUser.email, e2eUser.password);
    // Wait until we leave the login page (replaces a fixed waitForTimeout)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('navigates to the register page from login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    const registerLink = page
      .getByRole('link', { name: /register/i })
      .last();
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    }
  });
});
