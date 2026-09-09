import type { Player } from '../src/lib/types';
import { SEASON_YEAR } from '../src/lib/season-config';
import { playersCacheKey } from '../src/server/cache-keys';
import { readPublishedCache } from '../src/server/read-published-cache';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = playersCacheKey(SEASON_YEAR);
const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(): Promise<Response> {
  try {
    const { data, ...metadata } = await readPublishedCache<Player[]>(CACHE_KEY);
    const cachedPlayers = Array.isArray(data) ? data : [];

    if (cachedPlayers.length === 0) {
      return new Response(
        JSON.stringify({
          players: [],
          ...metadata,
          message: 'No cached player data found yet. Run `npm run refresh:players` (or the refresh-data workflow) first.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        players: cachedPlayers,
        ...metadata,
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
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
