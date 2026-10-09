export class HomePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectLoaded() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.locator('header, nav').first().waitFor({ state: 'visible' });
  }
}
