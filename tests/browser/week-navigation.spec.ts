import { expect, test } from '@playwright/test';
import { mockApp } from './fixtures';

for (const width of [768, 1024, 1280]) {
  test(`grouped week navigation stays clear of the status message at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const app = await mockApp(page);
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Game weeks' });
    const completed = navigation.getByRole('button', { name: /^Completed weeks/ });
    const postseason = navigation.getByRole('button', { name: /^Post season/ });
    await expect(navigation.getByRole('tab', { name: 'W0', exact: true })).toHaveCount(0);
    await expect(navigation.getByRole('tab', { name: 'NCG', exact: true })).toHaveCount(0);
    await expect(navigation.getByRole('tab', { name: 'Rival', exact: true })).toHaveCount(1);
    await postseason.click();
    await expect(page.getByRole('menuitemradio')).toHaveCount(5);
    await expect(page.getByRole('menuitemradio', { name: 'Championship Week', exact: true })).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'National Championship', exact: true }).click();
    await expect(postseason).toContainText('NCG');
    await expect(navigation.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0);
    const status = page.getByText('Week 18 lineup is open - each player locks when their own game kicks off', { exact: true });
    await expect(status).toBeVisible();
    const navBox = (await navigation.boundingBox())!;
    const completedBox = (await completed.boundingBox())!;
    const postseasonBox = (await postseason.boundingBox())!;
    const statusBox = (await status.boundingBox())!;
    expect(Math.abs(completedBox.y - postseasonBox.y)).toBeLessThanOrEqual(1);
    expect(statusBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
    expect(completedBox.x).toBeLessThan(postseasonBox.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await completed.click();
    await page.getByRole('menuitemradio', { name: 'Week 0', exact: true }).click();
    await expect(completed).toContainText('W0');
    await expect(postseason).not.toContainText('NCG');
    await expect(page.getByText('Week 0 is over - no changes allowed', { exact: true })).toBeVisible();
    await navigation.getByRole('tab', { name: 'W1', exact: true }).click();
    await expect(navigation.getByRole('tab', { name: 'W1', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(completed).not.toContainText('W0');
    await navigation.getByRole('tab', { name: 'Rival', exact: true }).click();
    await expect(navigation.getByRole('tab', { name: 'Rival', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(app.errors).toEqual([]);
  });
}

test('postseason selection supports keyboard navigation and checked menu state', async ({ page }) => {
  const app = await mockApp(page);
  await page.goto('/');
  const postseason = page.getByRole('button', { name: /^Post season/ });
  await postseason.focus();
  await postseason.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'Championship Week', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: 'National Championship', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(postseason).toContainText('NCG');
  await expect(postseason).toBeFocused();
  await postseason.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'National Championship', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(postseason).toBeFocused();
  expect(app.errors).toEqual([]);
});

test('a completed selected week moves into its menu on focus without changing selection', async ({ page }) => {
  const app = await mockApp(page);
  await page.clock.setFixedTime(new Date('2026-09-09T04:59:59.999Z'));
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Game weeks' });
  await expect(navigation.getByRole('tab', { name: 'W1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.clock.setFixedTime(new Date('2026-09-09T05:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(navigation.getByRole('tab', { name: 'W1', exact: true })).toHaveCount(0);
  const completed = navigation.getByRole('button', { name: /^Completed weeks/ });
  await expect(completed).toContainText('W1');
  await expect(page.getByText('Week 1 is over - no changes allowed', { exact: true })).toBeVisible();
  await completed.click();
  await expect(page.getByRole('menuitemradio', { name: 'Week 1', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(app.errors).toEqual([]);
});

test('all weeks remain selectable after the final week closes', async ({ page }) => {
  const app = await mockApp(page);
  await page.clock.setFixedTime(new Date('2027-01-27T06:00:00Z'));
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Game weeks' });
  await expect(navigation.getByRole('tab')).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: /^Post season/ })).toBeDisabled();
  const completed = navigation.getByRole('button', { name: /^Completed weeks/ });
  await expect(completed).toContainText('NCG');
  await completed.click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(19);
  await expect(page.getByRole('menuitemradio', { name: 'National Championship', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(app.errors).toEqual([]);
});

for (const width of [320, 390]) {
  test(`mobile selector keeps all grouped weeks reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const app = await mockApp(page);
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Game weeks' });
    const selector = navigation.getByRole('combobox', { name: 'Select game week' });
    await selector.click();
    await expect(page.getByRole('option')).toHaveCount(19);
    await expect(page.getByRole('listbox').getByText('Completed weeks', { exact: true })).toBeVisible();
    await expect(page.getByRole('listbox').getByText('Post season', { exact: true })).toBeVisible();
    await page.getByRole('option', { name: /^Week 18:/ }).click();
    await expect(selector).toContainText('National Championship');
    await selector.click();
    await page.getByRole('option', { name: /^Week 0:/ }).click();
    await expect(selector).toContainText('Week 0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(app.errors).toEqual([]);
  });
}
