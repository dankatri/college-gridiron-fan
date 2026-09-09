import { z } from 'zod';
import { createResource } from './async-resource';
import type { League } from './types';

export const apiLeagueSchema = z.object({
  id: z.string(), name: z.string(), description: z.string().nullable().optional(),
  ownerId: z.string(), ownerName: z.string().optional(), season: z.number(),
  joinCode: z.string().optional(), maxMembers: z.number(),
  isPublic: z.union([z.number(), z.boolean()]),
  allowLateJoins: z.union([z.number(), z.boolean()]),
  createdAt: z.string(), joinedAt: z.string().optional(), memberCount: z.number().optional(),
  members: z.array(z.object({
    userId: z.string(), displayName: z.string(), avatarUrl: z.string().nullable().optional(),
    role: z.enum(['owner', 'member']).optional(), joinedAt: z.string(),
  })).optional(),
});

const standingsSchema = z.object({
  leaderboard: z.array(z.object({
    rank: z.number(), userId: z.string(), username: z.string(),
    avatarUrl: z.string().nullable().optional(), totalPoints: z.number().finite(),
    weeklyPoints: z.record(z.number().finite()),
    weeksScored: z.number().optional(), winningWeeks: z.number().optional(),
  })),
});

export type ApiLeague = z.infer<typeof apiLeagueSchema>;
export type ApiLeaderboardEntry = z.infer<typeof standingsSchema>['leaderboard'][number];

export function toLeagueSummary(league: ApiLeague): League {
  return {
    id: league.id, name: league.name, description: league.description ?? undefined,
    ownerId: league.ownerId, ownerName: league.ownerName ?? 'Owner',
    joinCode: league.joinCode, memberCount: league.memberCount ?? 0, members: [],
    settings: {
      maxMembers: league.maxMembers, isPublic: Boolean(league.isPublic),
      allowLateJoins: Boolean(league.allowLateJoins), scoringMultiplier: 1,
    },
    createdAt: new Date(league.createdAt), season: league.season,
  };
}

export function toLeagueDetail(league: ApiLeague): League {
  return {
    ...toLeagueSummary(league),
    members: (league.members ?? []).map((member, index) => ({
      userId: member.userId, username: member.displayName, avatarUrl: member.avatarUrl ?? undefined,
      role: member.role ?? 'member', joinedAt: new Date(member.joinedAt),
      isActive: true, totalPoints: 0, weeklyPoints: {}, rank: index + 1,
    })),
  };
}

class LeagueRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'LeagueRequestError';
  }
}

export function isLeagueAccessError(error: Error | null): boolean {
  return error instanceof LeagueRequestError && [401, 403, 404].includes(error.status);
}

async function requestJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { credentials: 'include', signal });
  if ([401, 403, 404].includes(response.status)) {
    throw new LeagueRequestError(
      response.status === 401 ? 'Please sign in again to view this league.' : 'This league is no longer available to you.',
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = z.object({ error: z.string() }).safeParse(payload);
    throw new LeagueRequestError(message.success ? message.data.error : 'Unable to load league data. Please retry.', response.status);
  }
  return payload;
}

function createLeagueResources(leagueId: string) {
  const path = `/api/leagues/${encodeURIComponent(leagueId)}`;
  const standings = createResource(async signal => ({
    data: standingsSchema.parse(await requestJson(`${path}/leaderboard`, signal)).leaderboard,
  }), { ttlMs: 30_000, pollMs: 60_000, clearDataOnError: isLeagueAccessError });
  const details = createResource(async signal => {
    const { league } = z.object({ league: apiLeagueSchema }).parse(await requestJson(path, signal));
    if (league.id !== leagueId || !league.members) throw new Error('Invalid league details. Please retry.');
    return { data: league };
  }, { ttlMs: 300_000, clearDataOnError: isLeagueAccessError });
  return {
    standings,
    details,
    getAccessError: () => [standings.getSnapshot().error, details.getSnapshot().error].find(isLeagueAccessError) ?? null,
    observeAccess(listener: () => void) {
      // Observe late denials from inactive tabs without fetching their data eagerly.
      const stops = [standings.observe(listener), details.observe(listener)];
      return () => stops.forEach(stop => stop());
    },
  };
}

/** Owned by one signed-in App session; never persisted or shared between accounts. */
export function createLeagueViewCache(userId: string | null) {
  const entries = new Map<string, ReturnType<typeof createLeagueResources>>();
  const remove = (leagueId: string) => {
    const entry = entries.get(leagueId);
    entry?.standings.invalidate(true, false);
    entry?.details.invalidate(true, false);
    entries.delete(leagueId);
  };
  return {
    get(leagueId: string) {
      if (!userId || !leagueId) throw new Error('A signed-in user and league are required.');
      let entry = entries.get(leagueId);
      if (!entry) {
        entry = createLeagueResources(leagueId);
        entries.set(leagueId, entry);
      }
      return entry;
    },
    invalidateStandings(leagueId: string) {
      entries.get(leagueId)?.standings.invalidate(true);
    },
    invalidate(leagueId: string) {
      entries.get(leagueId)?.standings.invalidate(true);
      entries.get(leagueId)?.details.invalidate(true);
    },
    retain(leagueIds: string[]) {
      const allowed = new Set(leagueIds);
      for (const id of entries.keys()) if (!allowed.has(id)) remove(id);
    },
    remove,
    clear() {
      for (const id of entries.keys()) remove(id);
    },
  };
}

export type LeagueViewCache = ReturnType<typeof createLeagueViewCache>;
