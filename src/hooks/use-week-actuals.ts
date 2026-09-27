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
  /**
   * Teams whose box score is not yet verified for this week, lowercased to
   * match how the app keys teams. A player on one of these has no recorded
   * stat line *yet* — that is not a zero score.
   */
  pendingTeams: Set<string>;
}

const EMPTY = new Map<string, PlayerStats>();
const NO_PENDING_TEAMS = new Set<string>();

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
  const pendingTeams = useMemo(
    () => hasStarted && state.data?.pendingTeams?.length
      ? new Set(state.data.pendingTeams.map(team => team.toLowerCase()))
      : NO_PENDING_TEAMS,
    [hasStarted, state.data],
  );
  return {
    isLoading: hasStarted && state.data === undefined && !state.error,
    hasStarted, actuals, error: state.error, hasData: !!state.data, pendingTeams,
    isReliable: !!state.data && !state.error && state.sourceStatus !== 'refreshing',
  };
}
