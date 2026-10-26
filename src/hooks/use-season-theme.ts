import { useEffect } from 'react';

import { isFcsWeek } from '../lib/week-divisions';

/**
 * Toggles the Halloween theme attribute for Week 9 (also the FCS week).
 *
 * Setting/removing `document.documentElement.dataset.theme` drives the CSS
 * override in `styles/halloween.css` — no theme name is passed in directly
 * so this stays tied to the one week it's meant for, and the effect's own
 * cleanup (not just the `else` branch) guarantees the attribute never
 * outlives this week, even across unmounts.
 */
export function useSeasonTheme(week: number): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (isFcsWeek(week)) {
      document.documentElement.dataset.theme = 'halloween';
    } else {
      delete document.documentElement.dataset.theme;
    }

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [week]);
}
