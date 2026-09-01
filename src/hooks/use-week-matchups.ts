import { useEffect, useMemo, useState } from 'react';
import { getTeamSchedules } from '@/lib/schedule-data';
import type { TeamSchedule, WeeklyGame } from '@/lib/types';

export interface TeamWeekMatchup {
  /** The team's game in the requested week, if it has one. */
  game?: WeeklyGame;
  /** The team's next scheduled game after that week, used as a fallback. */
  nextGame?: WeeklyGame;
}

export interface WeekMatchups {
  isLoading: boolean;
  /** Keyed by lower-cased team name, since that is what players carry. */
  matchups: Map<string, TeamWeekMatchup>;
}

/**
 * Look up every team's game for a single week, so tables can show a matchup
 * next to each player without fetching schedules per row.
 */
export function useWeekMatchups(week?: number): WeekMatchups {
  const [schedules, setSchedules] = useState<TeamSchedule[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    getTeamSchedules()
      .then((loaded) => {
        if (!cancelled) setSchedules(loaded);
      })
      .catch((error) => {
        console.error('useWeekMatchups: failed to load schedules', error);
        if (!cancelled) setSchedules([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (schedules === null) {
      return { isLoading: true, matchups: new Map<string, TeamWeekMatchup>() };
    }

    const matchups = new Map<string, TeamWeekMatchup>();
    if (week === undefined) return { isLoading: false, matchups };

    for (const schedule of schedules) {
      const game = schedule.weeklyGames.find((candidate) => candidate.week === week);

      // Plenty of teams sit out a given week (Week 0 has only 22 games), so
      // fall back to their next fixture instead of showing nothing.
      const nextGame = game
        ? undefined
        : schedule.weeklyGames
            .filter((candidate) => candidate.week > week && !candidate.isByeWeek)
            .sort((a, b) => a.week - b.week)[0];

      matchups.set(schedule.teamName.toLowerCase(), { game, nextGame });
    }

    return { isLoading: false, matchups };
  }, [schedules, week]);
}
