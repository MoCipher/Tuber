import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown'),
  timeout: 30_000,
  expect: { toHaveScreenshot: { threshold: 0.02 } },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1200, height: 800 },
    ignoreHTTPSErrors: true
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !!process.env.CI === false,
    env: { VITE_API_BASE: process.env.VITE_API_BASE || 'http://localhost:4001/api' }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})
