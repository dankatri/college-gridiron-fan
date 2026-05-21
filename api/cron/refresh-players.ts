import pLimit from 'p-limit';
import { sql } from 'drizzle-orm';
import type { Player } from '../../src/lib/types';
import { MAJOR_PROGRAMS } from '../../src/lib/season-config';
import { db } from '../../src/server/db';
import { dataCache } from '../../src/server/schema';

export const config = {
  runtime: 'edge',
};

const CACHE_KEY = 'players-2026';
const ESPN_ROSTER_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR']);

type TeamEntry = {
  id: string;
  team: string;
  conference: string;
};

type EspnAthlete = {
  id?: string | number;
  fullName?: string;
  displayName?: string;
  position?: {
    abbreviation?: string;
  };
  headshot?: {
    href?: string;
  };
};

type EspnAthleteGroup = {
  items?: EspnAthlete[];
};

const getTeamsToFetch = (): TeamEntry[] => {
  const teams: TeamEntry[] = [];

  for (const [conference, conferenceTeams] of Object.entries(MAJOR_PROGRAMS)) {
    for (const [team, id] of Object.entries(conferenceTeams)) {
      teams.push({ id, team, conference });
    }
  }

  return teams;
};

const normalizeAthletes = (groups: unknown): EspnAthlete[] => {
  if (!Array.isArray(groups)) return [];
  if (groups.length === 0) return [];

  const first = groups[0] as EspnAthleteGroup;
  if (Array.isArray(first?.items)) {
    return (groups as EspnAthleteGroup[]).flatMap((group) => group.items ?? []);
  }

  return groups as EspnAthlete[];
};

const toPlayer = (athlete: EspnAthlete, team: TeamEntry): Player | null => {
  const playerId = athlete.id ? String(athlete.id) : '';
  const name = athlete.fullName?.trim() || athlete.displayName?.trim() || '';
  const position = athlete.position?.abbreviation?.toUpperCase() ?? '';

  if (!playerId || !name || !VALID_POSITIONS.has(position)) {
    return null;
  }

  const normalizedPosition = position as Player['position'];
  const fallbackHeadshot = `https://a.espncdn.com/i/headshots/college-football/players/full/${playerId}.png`;

  return {
    id: `espn_${normalizedPosition.toLowerCase()}_${playerId}`,
    name,
    position: normalizedPosition,
    team: team.team,
    conference: team.conference,
    projectedPoints: 0,
    headshotUrl: athlete.headshot?.href || fallbackHeadshot,
  };
};

const fetchTeamPlayers = async (team: TeamEntry): Promise<Player[]> => {
  const url = `${ESPN_ROSTER_URL}/${team.id}/roster`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[cron/refresh-players] Team roster request failed', {
        team: team.team,
        teamId: team.id,
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as { athletes?: unknown };
    const athletes = normalizeAthletes(data.athletes);
    const players = athletes
      .map((athlete) => toPlayer(athlete, team))
      .filter((player): player is Player => player !== null);

    console.log('[cron/refresh-players] Team processed', {
      team: team.team,
      teamId: team.id,
      conference: team.conference,
      players: players.length,
    });

    return players;
  } catch (error) {
    console.error('[cron/refresh-players] Team roster request error', {
      team: team.team,
      teamId: team.id,
      error,
    });
    return [];
  }
};

const getAuthToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  if (!authorizationHeader.startsWith('Bearer ')) return null;
  return authorizationHeader.slice('Bearer '.length);
};

export default async function handler(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const token = getAuthToken(request.headers.get('authorization'));

  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!token || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const teams = getTeamsToFetch();
  const limiter = pLimit(8);

  console.log('[cron/refresh-players] Starting refresh', {
    teams: teams.length,
    concurrency: 8,
    cacheKey: CACHE_KEY,
  });

  const teamPlayerLists = await Promise.all(teams.map((team) => limiter(() => fetchTeamPlayers(team))));
  const players = teamPlayerLists.flat();

  await db
    .insert(dataCache)
    .values({
      key: CACHE_KEY,
      data: players,
    })
    .onConflictDoUpdate({
      target: dataCache.key,
      set: {
        data: players,
        updatedAt: sql`now()`,
      },
    });

  const durationMs = Date.now() - startedAt;
  console.log('[cron/refresh-players] Refresh complete', {
    teams: teams.length,
    players: players.length,
    durationMs,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      teams: teams.length,
      players: players.length,
      durationMs,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
