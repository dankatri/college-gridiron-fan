import { useMemo } from 'react';
import { useScheduleData } from './use-schedule-data';
import type { WeeklyGame } from '@/lib/types';

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
  const { data: schedules } = useScheduleData(false, week !== undefined);

  return useMemo(() => {
    if (schedules === undefined) {
      return { isLoading: true, matchups: new Map<string, TeamWeekMatchup>() };
    }

    const matchups = new Map<string, TeamWeekMatchup>();
    if (week === undefined) return { isLoading: false, matchups };

    for (const schedule of schedules) {
      const games = schedule.weeklyGames.filter(candidate => candidate.week === week && !candidate.isByeWeek);
      const first = games[0] ?? schedule.weeklyGames.find(candidate => candidate.week === week);
      const game = first && games.length > 1 ? { ...first, isCompleted: games.every(candidate => candidate.isCompleted) } : first;

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
