import { useEffect, useMemo, useState } from 'react';
import { getTeamSchedules } from '@/lib/schedule-data';
import { isWeekComplete, lockedTeamsForWeek } from '@/lib/week-lock';
import type { TeamSchedule } from '@/lib/types';

export interface WeekLocks {
  isLoading: boolean;
  /** Lower-cased names of teams whose game this week has kicked off. */
  lockedTeams: Set<string>;
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
 * game kicks off, while everyone still waiting to play stays editable. The
 * schedule is re-read on a timer so a lineup left open on screen locks itself
 * as kickoffs pass, rather than only on reload.
 */
export function useWeekLocks(week?: number): WeekLocks {
  const [schedules, setSchedules] = useState<TeamSchedule[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    getTeamSchedules()
      .then((loaded) => {
        if (!cancelled) setSchedules(loaded);
      })
      .catch((error) => {
        console.error('useWeekLocks: failed to load schedules', error);
        if (!cancelled) setSchedules([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (schedules === null || week === undefined) {
      return {
        isLoading: schedules === null,
        lockedTeams: NO_TEAMS,
        isComplete: week === undefined ? false : isWeekComplete(week, new Date(now)),
        isPlayerLocked: () => false,
      };
    }

    const lockedTeams = lockedTeamsForWeek(schedules, week, new Date(now));

    return {
      isLoading: false,
      lockedTeams,
      isComplete: isWeekComplete(week, new Date(now)),
      isPlayerLocked: (team?: string | null) => (team ? lockedTeams.has(team.toLowerCase()) : false),
    };
  }, [schedules, week, now]);
}
