export class ShopPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/shop');
  }

  async search(query) {
    await this.page.fill('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', query);
  }
}
