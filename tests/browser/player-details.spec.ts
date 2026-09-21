import { expect, test } from '@playwright/test';
import { live, mockApp } from './fixtures';

const cases = [
  { width: 1280, height: 900, position: 'QB', gameCount: 1 },
  { width: 768, height: 600, position: 'QB', gameCount: 19 },
  { width: 390, height: 844, position: 'QB', gameCount: 19 },
  { width: 320, height: 568, position: 'QB', gameCount: 19 },
  { width: 844, height: 390, position: 'QB', gameCount: 19 },
  { width: 390, height: 844, position: 'RB', gameCount: 19 },
  { width: 390, height: 844, position: 'WR', gameCount: 19 },
] as const;

for (const { width, height, position, gameCount } of cases) {
  test(`player details stay readable for ${position} at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const app = await mockApp(page);
    const player = {
      ...app.state.playerPool[0], position, passingYards: 2894, passingTDs: 24,
      completions: 269, attempts: 386, interceptions: 5, rushingYards: 462,
      rushingTDs: 10, receivingYards: 850, receivingTDs: 8, receptions: 67, returnYards: 123,
    };
    app.state.playerPool = [player];
    const games = Array.from({ length: gameCount }, (_, week) => ({
      ...live.stats[0], week, opponent: 'Massachusetts Institute of Technology',
      isHomeGame: true, teamPoints: 63, opponentPoints: 3, fantasyPoints: 24.2,
    }));
    await page.route('**/api/player-log?**', route => route.fulfill({
      json: { games, totals: { games: games.length, fantasyPoints: games.length * 24.2 } },
    }));
    await page.goto('/');
    if (width < 768) {
      await page.getByRole('button', { name: 'Browse Available Players', exact: true }).click();
    }
    if (position !== 'QB') {
      await page.getByRole('tab', { name: position === 'RB' ? 'Running Backs' : 'Wide Receivers', exact: true }).click();
    }
    await page.getByRole('button', { name: player.name, exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole('dialog', { name: player.name });
    const table = dialog.getByRole('table');
    const scroller = dialog.locator('[data-slot="table-container"]');
    await expect(table.getByRole('row')).toHaveCount(gameCount + 1);
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.screenshot({ path: info.outputPath('player-details.png'), fullPage: true });

    const bounds = await dialog.boundingBox();
    const scrollBounds = await scroller.boundingBox();
    expect(bounds).not.toBeNull();
    expect(scrollBounds).not.toBeNull();
    expect(scrollBounds!.x).toBeGreaterThanOrEqual(bounds!.x + 15);
    expect(scrollBounds!.x + scrollBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width - 15);
    expect(bounds!.x).toBeGreaterThanOrEqual(15);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 15);
    expect(bounds!.y).toBeGreaterThanOrEqual(15);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height - 15);
    expect(scrollBounds!.height).toBeLessThanOrEqual(257);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width === 1280) expect(bounds!.width).toBeGreaterThanOrEqual(1000);

    const headings = await table.getByRole('columnheader').allTextContents();
    expect(headings.slice(0, 4)).toEqual(['Week', 'Opponent', 'Result', 'Pts']);
    expect(headings[4]).toBe(position === 'QB' ? 'Comp' : position === 'RB' ? 'Rush Yds' : 'Rec');
    await expect(table.getByRole('row').nth(1).getByRole('cell').nth(3)).toHaveText('24.2');

    await scroller.scrollIntoViewIfNeeded();
    await scroller.focus();
    if (await scroller.evaluate(element => element.scrollWidth > element.clientWidth)) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    await scroller.evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = element.scrollHeight;
    });
    await expect(table.getByRole('row').last().getByRole('cell').last()).toBeInViewport();
    const body = dialog.getByRole('region', { name: 'Player statistics', exact: true });
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.getByRole('heading', { name: '2025 season totals' })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(app.errors).toEqual([]);
  });
}
