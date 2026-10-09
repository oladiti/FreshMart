import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PREVIEW_PORT = 4173;
const BACKEND_PORT = 5000;

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PREVIEW_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  webServer: [
    {
      command: 'node server.js',
      url: `http://localhost:${BACKEND_PORT}`,
      cwd: path.join(root, 'server'),
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: true,
      timeout: 120000,
      // vite preview runs in production mode, so it would otherwise pick up
      // .env.production's relative VITE_API_URL=/api - correct when the backend
      // serves the built bundle from the same origin, but here the preview and
      // the API are different origins, so every request would 404 against the
      // static server. Real process env vars outrank .env files in Vite, so
      // this wins without a cross-env dependency.
      env: { VITE_API_URL: `http://localhost:${BACKEND_PORT}/api` },
    },
  ],
  globalSetup: './e2e/globalSetup.js',
});
