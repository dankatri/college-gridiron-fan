import { ALL_WEEKS } from './types';
import { isWeekComplete } from './week-lock';

interface WeeklyScores {
  userId: string;
  weeklyPoints: Readonly<Partial<Record<number, number>>>;
}

export function countWinningWeeks(
  entries: readonly WeeklyScores[],
  availableWeeks: Iterable<number> = ALL_WEEKS,
  now: Date = new Date(),
  gameFinals?: ReadonlySet<number>,
): Map<string, number> {
  const wins = new Map(entries.map(entry => [entry.userId, 0]));
  const available = new Set(availableWeeks);
  for (const week of ALL_WEEKS) {
    if (!available.has(week) || !isWeekComplete(week, now, gameFinals)) continue;
    let highest = -Infinity;
    let winners: string[] = [];
    for (const entry of entries) {
      const points = entry.weeklyPoints[week];
      if (points === undefined) continue;
      if (!Number.isFinite(points)) throw new Error('Weekly leaderboard scores must be finite');
      const score = Number(points.toFixed(2));
      if (score > highest) {
        highest = score;
        winners = [entry.userId];
      } else if (score === highest) {
        winners.push(entry.userId);
      }
    }
    for (const userId of winners) wins.set(userId, wins.get(userId)! + 1);
  }
  return wins;
}
