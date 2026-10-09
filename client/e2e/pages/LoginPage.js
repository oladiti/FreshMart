export class LoginPage {
  constructor(page) {
    this.page = page;
    // Scope everything to the login form. The footer carries a newsletter
    // "Email address" field, and getByLabel() matches on substrings, so an
    // unscoped `getByLabel('Email')` resolves to both and trips strict mode.
    // Keying off the form's accessible name also skips the footer <form>.
    this.form = page.getByRole('form', { name: 'Login form' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async fillLogin(email, password) {
    await this.form.getByLabel('Email').fill(email);
    await this.form.getByLabel('Password').fill(password);
  }

  async clickLogin() {
    await this.form.getByRole('button', { name: /login/i }).click();
  }

  async login(email, password) {
    await this.goto();
    await this.fillLogin(email, password);
    await this.clickLogin();
  }

  // The inline validation banner rendered above the form on a failed login.
  // Locators are synchronous by design, so callers can pass this straight to
  // expect(...).toBeVisible() without awaiting a promise.
  errorMessage() {
    return this.page.locator('.bg-red-50');
  }
}
