import { useMemo } from 'react';
import { getLiveResource } from '@/lib/live-data';
import { useResource } from './use-resource';
import { useMinuteClock } from './use-minute-clock';
import type { PlayerStats } from '@/lib/types';
import { hasWeekStarted, isWeekComplete } from '@/lib/week-lock';
import { FIRST_WEEK } from '@/lib/types';

export interface WeekActuals {
  isLoading: boolean;
  /** True once the week has started, so real scores exist to show. */
  hasStarted: boolean;
  /** Box scores for the week, keyed by player id. Empty until loaded. */
  actuals: Map<string, PlayerStats>;
  error: Error | null;
  hasData: boolean;
  isReliable: boolean;
}

const EMPTY = new Map<string, PlayerStats>();

/**
 * Load actual fantasy scores for an opened week. Future weeks are not fetched
 * before their editing window opens.
 */
export function useWeekActuals(week?: number): WeekActuals {
  const now = useMinuteClock();
  const hasStarted = week !== undefined && hasWeekStarted(week, new Date(now));
  const state = useResource(
    getLiveResource(week ?? FIRST_WEEK), hasStarted,
    week !== undefined && !isWeekComplete(week, new Date(now)),
  );
  const actuals = useMemo(
    () => hasStarted && state.data ? new Map(state.data.stats.map(stat => [stat.playerId, stat])) : EMPTY,
    [hasStarted, state.data],
  );
  return {
    isLoading: hasStarted && state.data === undefined && !state.error,
    hasStarted, actuals, error: state.error, hasData: !!state.data,
    isReliable: !!state.data && !state.error && state.sourceStatus !== 'refreshing',
  };
}
