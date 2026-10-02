import { z } from 'zod';
import { completedGameWeeks } from '../lib/week-lock';
import { SEASON_YEAR } from '../lib/season-config';
import { projectCompletedGameWeeks } from './cache-projections';

export const scheduleCompletionSchema = z.array(z.object({
  weeklyGames: z.array(z.object({
    week: z.number().int(), isByeWeek: z.boolean(),
    gameId: z.string().optional(), isCompleted: z.boolean().optional(),
    teamPoints: z.number().finite().optional(), opponentPoints: z.number().finite().optional(),
  })),
}));

/** Missing/malformed evidence cannot establish early closure. Member saves
 * separately require usable schedules before allowing any player changes. */
export function completedGameWeeksFromCache(data: unknown): Set<number> {
  const parsed = scheduleCompletionSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('Schedule completion evidence is unavailable; retaining the calendar cutoff.', {
      issues: parsed.error.issues.map(issue => ({ path: issue.path, code: issue.code })),
    });
    return new Set();
  }
  return completedGameWeeks(parsed.data);
}

export async function loadCompletedGameWeeks(): Promise<Set<number>> {
  const { db } = await import('./db');
  const result = await db.execute<{ week: number }>(projectCompletedGameWeeks(SEASON_YEAR));
  return new Set(result.rows.map(row => row.week));
}
