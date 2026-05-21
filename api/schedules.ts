import { eq } from 'drizzle-orm';
import { db } from '../src/server/db';
import { dataCache } from '../src/server/schema';
import { SEASON_YEAR } from '../src/lib/season-config';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = `schedules-${SEASON_YEAR}`;

export default async function handler(): Promise<Response> {
  try {
    const rows = await db
      .select()
      .from(dataCache)
      .where(eq(dataCache.key, CACHE_KEY))
      .limit(1);

    const row = rows[0];
    const schedules = Array.isArray(row?.data) ? row.data : [];

    return new Response(
      JSON.stringify({
        schedules,
        updatedAt: row?.updatedAt ?? null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
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
