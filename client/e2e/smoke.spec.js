const { test, expect } = require('@playwright/test');

test('loads app shell', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/unicon/`);
  await expect(page.getByText('Unicon')).toBeVisible();
});
