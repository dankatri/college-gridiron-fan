import { SEASON_YEAR } from '../src/lib/season-config';
import { readPublishedCache } from '../src/server/read-published-cache';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = `schedules-${SEASON_YEAR}`;

export default async function handler(): Promise<Response> {
  try {
    const { data, ...metadata } = await readPublishedCache<unknown[]>(CACHE_KEY);
    const schedules = Array.isArray(data) ? data : [];

    return new Response(
      JSON.stringify({
        schedules,
        ...metadata,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Schedules look static but carry live completion flags and scores,
          // which turn over every few hours on a game day. Cached as fixtures
          // (an hour fresh, then a day of stale-while-revalidate) a finished
          // game could keep reporting as merely kicked off for a whole day.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[api/schedules] Error:', error);
    return new Response(
      JSON.stringify({ schedules: [], error: 'Failed to load schedules' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
