import { expect, test } from '@playwright/test';
import { mockApp } from './fixtures';

const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Reminders:/ });

test('the reminder toggle reflects the saved preference and survives a reload', async ({ page }) => {
  const app = await mockApp(page);
  await page.goto('/');
  await expect(toggle(page)).toHaveText('Reminders: On');

  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Reminders: Off');
  expect(app.requests).toContain('PATCH /api/notifications/preferences');

  await page.reload();
  await expect(toggle(page)).toHaveText('Reminders: Off');
  expect(app.errors).toEqual([]);
});

test('a failed preference save leaves the toggle showing the state the server still holds', async ({ page }) => {
  const app = await mockApp(page);
  app.state.preferencesFail = true;
  await page.goto('/');
  await toggle(page).click();
  await expect(page.getByText('Failed to update email reminders')).toBeVisible();
  await expect(toggle(page)).toHaveText('Reminders: On');
  expect(app.errors).toEqual([]);
});
