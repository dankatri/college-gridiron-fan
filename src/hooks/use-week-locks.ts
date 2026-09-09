import { useMemo } from 'react';
import { useScheduleData } from './use-schedule-data';
import { useMinuteClock } from './use-minute-clock';
import { finishedTeamsForWeek, isWeekComplete, lockedTeamsForWeek } from '@/lib/week-lock';

export interface WeekLocks {
  isLoading: boolean;
  error: Error | null;
  /** Lower-cased names of teams whose game this week has kicked off. */
  lockedTeams: Set<string>;
  /** Those of `lockedTeams` whose game is over rather than still being played. */
  finishedTeams: Set<string>;
  /** True once the week is over and nothing in it can change. */
  isComplete: boolean;
  /** Whether this player is frozen because their own game has begun. */
  isPlayerLocked: (team?: string | null) => boolean;
}

const NO_TEAMS = new Set<string>();

/**
 * Which players are frozen for a week.
 *
 * Locks are per player, not per week: a slot settles the moment that player's
 * game kicks off, while everyone still waiting to play stays editable. Both the
 * clock and the schedule are re-read on a timer, so a lineup left open locks
 * itself as kickoffs pass and notices games finishing, rather than only on
 * reload. Kickoff is a question about the clock, but completion is a fact that
 * only arrives with fresh data, so advancing the clock alone is not enough.
 */
export function useWeekLocks(week?: number): WeekLocks {
  const now = useMinuteClock();
  const { data: schedules, error } = useScheduleData(
    week !== undefined && !isWeekComplete(week, new Date(now)),
    week !== undefined,
  );

  return useMemo(() => {
    if (schedules === undefined || week === undefined) {
      return {
        isLoading: schedules === undefined,
        error,
        lockedTeams: NO_TEAMS,
        finishedTeams: NO_TEAMS,
        isComplete: week === undefined ? false : isWeekComplete(week, new Date(now)),
        isPlayerLocked: () => schedules === undefined,
      };
    }

    const lockedTeams = lockedTeamsForWeek(schedules, week, new Date(now));

    return {
      isLoading: false,
      error,
      lockedTeams,
      finishedTeams: finishedTeamsForWeek(schedules, week),
      isComplete: isWeekComplete(week, new Date(now)),
      isPlayerLocked: (team?: string | null) => (team ? lockedTeams.has(team.toLowerCase()) : false),
    };
  }, [schedules, week, now, error]);
}
