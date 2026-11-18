import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const rootDir = __dirname;
const mongoUri = process.env['E2E_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017/devportal-e2e';
const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:5000';
const frontendUrl = process.env['E2E_FRONTEND_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(rootDir, 'backend'),
      url: `${apiUrl}/api/health`,
      reuseExistingServer: Boolean(process.env['CI']),
      timeout: 180_000,
      env: {
        MONGO_URI: mongoUri,
        CLIENT_URL: frontendUrl,
        TRUST_PROXY: '0',
      },
    },
    {
      command: 'npm start -- --host localhost --port 4200',
      cwd: path.join(rootDir, 'frontend'),
      url: frontendUrl,
      reuseExistingServer: Boolean(process.env['CI']),
      timeout: 240_000,
    },
  ],
});
