import { eq } from 'drizzle-orm';
import { db } from '../src/server/db';
import { dataCache } from '../src/server/schema';
import { SEASON_YEAR } from '../src/lib/season-config';
import { teamsCacheKey } from '../src/server/cache-keys';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = teamsCacheKey(SEASON_YEAR);

export default async function handler(): Promise<Response> {
  try {
    const rows = await db
      .select()
      .from(dataCache)
      .where(eq(dataCache.key, CACHE_KEY))
      .limit(1);

    const row = rows[0];
    const teams = Array.isArray(row?.data) ? row.data : [];

    return new Response(
      JSON.stringify({ teams, updatedAt: row?.updatedAt ?? null }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('[api/teams] Error:', error);
    return new Response(JSON.stringify({ teams: [], error: 'Failed to load teams' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
