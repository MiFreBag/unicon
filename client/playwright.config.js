// client/playwright.config.js
// Minimal Playwright setup to sanity-check the UI
// Run with: npx playwright test (from client)

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    port: 5174,
    reuseExistingServer: true,
    timeout: 60000,
  },
};

module.exports = config;
