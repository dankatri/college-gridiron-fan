import { expect, test } from '@playwright/test';
import type { Player } from '../../src/lib/types';
import { mockApp, players } from './fixtures';

const FCS_QB: Player = {
  id: 'qb-fcs', name: 'Spooky Passer', position: 'QB', team: 'Haunted State',
  conference: 'Big Sky', classification: 'fcs', projectedPoints: 30,
  passingYards: 300, passingTDs: 3,
};

const FBS_QB: Player = { ...players.find(player => player.id === 'qb-future')!, classification: 'fbs' };

async function mockMixedPool(page: Parameters<typeof mockApp>[0]) {
  const app = await mockApp(page);
  app.state.playerPool = [...players, FCS_QB];
  return app;
}

const themeAttribute = (page: Parameters<typeof mockApp>[0]) =>
  page.evaluate(() => document.documentElement.dataset.theme ?? null);

// Both the desktop table and the mobile sheet stay mounted at every width, so a
// player name resolves several times over. The visible one is the assertion
// that matters; absence still has to hold across every copy.
const shownPlayer = (page: Parameters<typeof mockApp>[0], name: string) =>
  page.getByRole('button', { name, exact: true }).filter({ visible: true });
const anyPlayer = (page: Parameters<typeof mockApp>[0], name: string) =>
  page.getByRole('button', { name, exact: true });

test('week 9 is an FCS-only slate wearing the Halloween theme', async ({ page }) => {
  const app = await mockMixedPool(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Game weeks' });
  await navigation.getByRole('tab', { name: 'W9', exact: true }).click();
  await expect(navigation.getByRole('tab', { name: 'W9', exact: true })).toHaveAttribute('aria-selected', 'true');

  await expect.poll(() => themeAttribute(page)).toBe('halloween');

  // The pool narrows to FCS, so the FBS quarterbacks the other weeks rely on
  // must be absent rather than merely sorted below.
  await expect(shownPlayer(page, FCS_QB.name)).toBeVisible();
  await expect(anyPlayer(page, FBS_QB.name)).toHaveCount(0);

  await expect(page.getByRole('heading', { name: "College Football Spook 'Em", level: 1 })).toBeVisible();

  expect(app.errors).toEqual([]);
});

test('an ordinary week keeps its FBS pool and no Halloween theme', async ({ page }) => {
  const app = await mockMixedPool(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Game weeks' });
  await navigation.getByRole('tab', { name: 'W8', exact: true }).click();
  await expect(navigation.getByRole('tab', { name: 'W8', exact: true })).toHaveAttribute('aria-selected', 'true');

  await expect(shownPlayer(page, FBS_QB.name)).toBeVisible();
  await expect(anyPlayer(page, FCS_QB.name)).toHaveCount(0);
  expect(await themeAttribute(page)).toBeNull();

  await expect(page.getByRole('heading', { name: "College Football Pick 'Em", level: 1 })).toBeVisible();

  expect(app.errors).toEqual([]);
});

test('leaving week 9 takes the Halloween theme with it', async ({ page }) => {
  const app = await mockMixedPool(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Game weeks' });
  await navigation.getByRole('tab', { name: 'W9', exact: true }).click();
  await expect.poll(() => themeAttribute(page)).toBe('halloween');

  await navigation.getByRole('tab', { name: 'W10', exact: true }).click();
  await expect.poll(() => themeAttribute(page)).toBeNull();

  expect(app.errors).toEqual([]);
});

/**
 * The decorations once mounted, sized and positioned correctly while painting
 * nothing at all: a negative z-index put them behind the app root's opaque
 * `bg-background`. Asserting they exist in the DOM cannot catch that, so this
 * compares the ghost's own pixels against the same region with it hidden.
 */
test('the decorations actually paint instead of hiding behind the background', async ({ page }) => {
  const app = await mockMixedPool(page);
  await page.goto('/');

  await page.getByRole('navigation', { name: 'Game weeks' })
    .getByRole('tab', { name: 'W9', exact: true }).click();

  const ghost = page.locator('.halloween-ghost').first();
  await expect(ghost).toBeVisible();
  const clip = (await ghost.boundingBox())!;

  const painted = await page.screenshot({ clip });
  await page.addStyleTag({ content: '.halloween-ghost,.halloween-pumpkin{visibility:hidden !important}' });
  await expect.poll(async () => Buffer.compare(await page.screenshot({ clip }), painted) !== 0).toBe(true);

  expect(app.errors).toEqual([]);
});
