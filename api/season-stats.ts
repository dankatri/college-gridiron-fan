import { db } from '../src/server/db';
import { SEASON_YEAR } from '../src/lib/season-config';
import { ALL_WEEKS } from '../src/lib/types';
import { hasWeekStarted } from '../src/lib/week-lock';
import { seasonStatsSchema } from '../src/lib/season-stats';
import { projectSeasonStats, seasonStatsSnapshot, type SeasonStatsProjection } from '../src/server/season-stats';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  try {
    const now = new Date();
    const weeks = ALL_WEEKS.filter(week => hasWeekStarted(week, now));
    const result = await db.execute<SeasonStatsProjection>(projectSeasonStats(SEASON_YEAR, weeks));
    const payload = seasonStatsSchema.parse(seasonStatsSnapshot(SEASON_YEAR, weeks, result.rows[0]));
    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[api/season-stats] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load season stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
