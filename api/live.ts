import { eq } from 'drizzle-orm';
import { db } from '../src/server/db';
import { dataCache } from '../src/server/schema';
import { SEASON_YEAR } from '../src/lib/season-config';
import { liveStatsCacheKey } from '../src/server/cache-keys';
import { FIRST_WEEK, LAST_WEEK } from '../src/lib/types';

export const config = {
  runtime: 'edge',
};

const EMPTY = { week: null, stats: [], games: [], updatedAt: null };

export default async function handler(request: Request): Promise<Response> {
  try {
    const weekParam = new URL(request.url).searchParams.get('week');
    const week = Number(weekParam);
    // Week 0 is valid, so reject a missing param explicitly rather than
    // relying on Number(null) === 0.
    if (weekParam === null || !Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
      return new Response(JSON.stringify(EMPTY), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await db
      .select()
      .from(dataCache)
      .where(eq(dataCache.key, liveStatsCacheKey(SEASON_YEAR, week)))
      .limit(1);

    const payload = rows[0]?.data ?? null;

    return new Response(
      JSON.stringify(payload ?? EMPTY),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Live data turns over quickly; keep the edge cache short.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[api/live] Error:', error);
    return new Response(
      JSON.stringify({ week: null, stats: [], games: [], error: 'Failed to load live data' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
