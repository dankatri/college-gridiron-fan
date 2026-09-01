import { useEffect, useState } from 'react';
import { getWeekPlayerStats } from '@/lib/live-data';
import type { PlayerStats } from '@/lib/types';
import { isWeekLocked } from '@/lib/utils-fantasy';

export interface WeekActuals {
  isLoading: boolean;
  /** True once the week has started, so real scores exist to show. */
  hasStarted: boolean;
  /** Box scores for the week, keyed by player id. Empty until loaded. */
  actuals: Map<string, PlayerStats>;
}

const EMPTY = new Map<string, PlayerStats>();

/**
 * Load a week's actual fantasy scores so past weeks can show what players
 * really did instead of a projection. Weeks that have not kicked off yet are
 * never fetched, since there is nothing to show.
 */
export function useWeekActuals(week?: number): WeekActuals {
  const hasStarted = week !== undefined && isWeekLocked(week);
  const [state, setState] = useState<{ week?: number; actuals: Map<string, PlayerStats> } | null>(null);

  useEffect(() => {
    if (week === undefined || !hasStarted) {
      setState({ week, actuals: EMPTY });
      return;
    }

    let cancelled = false;
    setState(null);

    getWeekPlayerStats(week)
      .then((actuals) => {
        if (!cancelled) setState({ week, actuals });
      })
      .catch((error) => {
        console.error('useWeekActuals: failed to load live stats', error);
        if (!cancelled) setState({ week, actuals: EMPTY });
      });

    return () => {
      cancelled = true;
    };
  }, [week, hasStarted]);

  if (state === null || state.week !== week) {
    return { isLoading: hasStarted, hasStarted, actuals: EMPTY };
  }

  return { isLoading: false, hasStarted, actuals: state.actuals };
}
