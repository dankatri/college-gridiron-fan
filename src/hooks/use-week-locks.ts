import { useEffect, useMemo, useState } from 'react';
import { getTeamSchedules } from '@/lib/schedule-data';
import { finishedTeamsForWeek, isWeekComplete, lockedTeamsForWeek } from '@/lib/week-lock';
import type { TeamSchedule } from '@/lib/types';

export interface WeekLocks {
  isLoading: boolean;
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
  const [schedules, setSchedules] = useState<TeamSchedule[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      getTeamSchedules()
        .then((loaded) => {
          if (cancelled) return;
          setSchedules(loaded);
          setNow(Date.now());
        })
        .catch((error) => {
          console.error('useWeekLocks: failed to load schedules', error);
          if (!cancelled) setSchedules((previous) => previous ?? []);
        });
    };

    refresh();
    const timer = window.setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return useMemo(() => {
    if (schedules === null || week === undefined) {
      return {
        isLoading: schedules === null,
        lockedTeams: NO_TEAMS,
        finishedTeams: NO_TEAMS,
        isComplete: week === undefined ? false : isWeekComplete(week, new Date(now)),
        isPlayerLocked: () => false,
      };
    }

    const lockedTeams = lockedTeamsForWeek(schedules, week, new Date(now));

    return {
      isLoading: false,
      lockedTeams,
      finishedTeams: finishedTeamsForWeek(schedules, week),
      isComplete: isWeekComplete(week, new Date(now)),
      isPlayerLocked: (team?: string | null) => (team ? lockedTeams.has(team.toLowerCase()) : false),
    };
  }, [schedules, week, now]);
}
