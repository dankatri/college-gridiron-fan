import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { leagueMembers, leagues, users } from '../../src/server/schema';
import { requireUser } from '../../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

type CreateLeagueBody = {
  name?: string;
  description?: string;
  season?: number;
  maxMembers?: number;
  isPublic?: boolean;
  allowLateJoins?: boolean;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateJoinCode(length = 8): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function findUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateJoinCode();
    const existing = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.joinCode, code)).limit(1);
    if (!existing[0]) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique join code');
}

async function getMemberCounts(leagueIds: string[]): Promise<Map<string, number>> {
  if (leagueIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      leagueId: leagueMembers.leagueId,
      count: sql<number>`count(*)::int`,
    })
    .from(leagueMembers)
    .where(inArray(leagueMembers.leagueId, leagueIds))
    .groupBy(leagueMembers.leagueId);

  return new Map(rows.map((row) => [row.leagueId, Number(row.count)]));
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    try {
      const user = await requireUser(request);
      const memberships = await db
        .select({
          leagueId: leagueMembers.leagueId,
        })
        .from(leagueMembers)
        .where(eq(leagueMembers.userId, user.id));

      const leagueIds = memberships.map((membership) => membership.leagueId);
      if (leagueIds.length === 0) {
        return jsonResponse({ leagues: [] });
      }

      const leagueRows = await db
        .select({
          id: leagues.id,
          name: leagues.name,
          description: leagues.description,
          ownerId: leagues.ownerId,
          season: leagues.season,
          joinCode: leagues.joinCode,
          maxMembers: leagues.maxMembers,
          isPublic: leagues.isPublic,
          allowLateJoins: leagues.allowLateJoins,
          createdAt: leagues.createdAt,
          ownerName: users.displayName,
        })
        .from(leagues)
        .innerJoin(users, eq(users.id, leagues.ownerId))
        .where(inArray(leagues.id, leagueIds));

      const memberCounts = await getMemberCounts(leagueIds);

      return jsonResponse({
        leagues: leagueRows.map((league) => ({
          ...league,
          memberCount: memberCounts.get(league.id) ?? 0,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch leagues';
      const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
      return jsonResponse({ error: message }, status);
    }
  }

  if (request.method === 'POST') {
    let body: CreateLeagueBody;
    try {
      body = (await request.json()) as CreateLeagueBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const name = body.name?.trim() ?? '';
    const description = body.description?.trim() || null;
    const season = Number.isInteger(body.season) ? (body.season as number) : new Date().getUTCFullYear();
    const maxMembers = Number.isInteger(body.maxMembers) ? Math.max(2, Math.min(32, body.maxMembers as number)) : 8;
    const isPublic = body.isPublic ? 1 : 0;
    const allowLateJoins = body.allowLateJoins === false ? 0 : 1;

    if (!name) {
      return jsonResponse({ error: 'League name is required' }, 400);
    }

    try {
      const user = await requireUser(request);
      const joinCode = await findUniqueJoinCode();

      const inserted = await db
        .insert(leagues)
        .values({
          name,
          description,
          ownerId: user.id,
          season,
          joinCode,
          maxMembers,
          isPublic,
          allowLateJoins,
        })
        .returning({
          id: leagues.id,
          name: leagues.name,
          description: leagues.description,
          ownerId: leagues.ownerId,
          season: leagues.season,
          joinCode: leagues.joinCode,
          maxMembers: leagues.maxMembers,
          isPublic: leagues.isPublic,
          allowLateJoins: leagues.allowLateJoins,
          createdAt: leagues.createdAt,
        });

      const createdLeague = inserted[0];
      if (!createdLeague) {
        return jsonResponse({ error: 'Failed to create league' }, 500);
      }

      try {
        await db.insert(leagueMembers).values({
          leagueId: createdLeague.id,
          userId: user.id,
          role: 'owner',
        });
      } catch (error) {
        await db.delete(leagues).where(eq(leagues.id, createdLeague.id));
        throw error;
      }

      return jsonResponse({
        league: {
          ...createdLeague,
          ownerName: user.displayName,
          memberCount: 1,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create league';
      const status = message === 'Not authenticated' || message === 'Invalid session' ? 401 : 500;
      return jsonResponse({ error: message }, status);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
