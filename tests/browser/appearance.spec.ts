import { expect, test } from '@playwright/test';
import { mockApp } from './fixtures';

for (const width of [1280, 390]) {
  for (const dark of [false, true]) {
    test(`lineup appearance ${width} ${dark ? 'dark' : 'light'}`, async ({ page }, info) => {
      const app = await mockApp(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
      await expect(page.getByRole('heading', { name: "College Football Pick 'Em" })).toBeVisible();
      await expect(page.getByRole('button', { name: /Save Week 1 Lineup/ }).filter({ visible: true })).toBeEnabled();
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      const styles = await page.evaluate(() => {
        const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
          .find(element => element.getBoundingClientRect().width > 0)!;
        const properties = ['backgroundColor', 'color', 'borderColor', 'borderRadius', 'paddingTop', 'paddingRight', 'gap', 'fontSize'] as const;
        return Object.fromEntries(Object.entries({
          body: document.body,
          card: visible('[data-slot="card"]'),
          button: visible('button.bg-primary'),
          group: visible('.rounded-lg.border.bg-card.overflow-hidden'),
          slot: visible('.border-dashed'),
        }).map(([name, element]) => {
          const computed = getComputedStyle(element);
          return [name, Object.fromEntries(properties.map(property => [property, computed[property]]))];
        }));
      });
      expect(JSON.stringify(styles, null, 2)).toMatchSnapshot(`lineup-${width}-${dark ? 'dark' : 'light'}.json`);
      await page.screenshot({ path: info.outputPath('lineup.png'), fullPage: true });
      expect(app.errors).toEqual([]);
    });
  }
}
