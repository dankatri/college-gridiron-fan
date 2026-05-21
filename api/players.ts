import { eq } from 'drizzle-orm';
import type { Player } from '../src/lib/types';
import { db } from '../src/server/db';
import { dataCache } from '../src/server/schema';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = 'players-2026';
const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(): Promise<Response> {
  try {
    const rows = await db
      .select()
      .from(dataCache)
      .where(eq(dataCache.key, CACHE_KEY))
      .limit(1);

    const cachedRow = rows[0];
    const cachedPlayers = Array.isArray(cachedRow?.data) ? (cachedRow.data as Player[]) : [];

    if (cachedPlayers.length === 0) {
      return new Response(
        JSON.stringify({
          players: [],
          message: 'No cached player data found yet. Run /api/cron/refresh-players first.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': CACHE_CONTROL,
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        players: cachedPlayers,
        updatedAt: cachedRow?.updatedAt ?? null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    console.error('[api/players] Failed to load cached players', { error });
    return new Response(
      JSON.stringify({
        players: [],
        message: 'Failed to load cached players',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': CACHE_CONTROL,
        },
      },
    );
  }
}
