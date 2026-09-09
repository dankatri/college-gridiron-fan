import { z } from 'zod';
import { createResource, type AsyncResource } from './async-resource';
import { FIRST_WEEK, LAST_WEEK, type GameStatus, type PlayerStats } from './types';
import { SEASON_YEAR } from './season-config';
import { sourceMetadataFields, resourceSource } from './source-metadata';

export interface LiveDataPayload {
  week: number | null;
  seasonType?: string;
  updatedAt: string | null;
  stats: PlayerStats[];
  games: GameStatus[];
}

const date = z.string().datetime({ offset: true }).transform(value => new Date(value));
const payloadSchema = z.object({
  week: z.number().int().nullable(),
  updatedAt: z.string().nullable(),
  seasonType: z.string().optional(),
  stats: z.array(z.object({
    playerId: z.string(), week: z.number().int(),
    passingYards: z.number(), passingTDs: z.number(), completions: z.number(),
    attempts: z.number(), interceptions: z.number(), rushingYards: z.number(),
    rushingTDs: z.number(), receivingYards: z.number(), receptions: z.number(),
    receivingTDs: z.number(), kickReturnYards: z.number(), puntReturnYards: z.number(),
    fantasyPoints: z.number(), lastUpdated: date,
  })),
  games: z.array(z.object({
    week: z.number().int(), team1: z.string(), team2: z.string(),
    status: z.enum(['scheduled', 'in-progress', 'final']),
    quarter: z.number().optional(), timeRemaining: z.string().optional(),
    team1Score: z.number(), team2Score: z.number(), lastUpdated: date,
  })),
}).merge(sourceMetadataFields);

const resources = new Map<string, AsyncResource<LiveDataPayload | null>>();

export function getLiveResource(week: number): AsyncResource<LiveDataPayload | null> {
  if (!Number.isInteger(week) || week < FIRST_WEEK || week > LAST_WEEK) {
    throw new Error('Invalid live scoring week');
  }
  const key = `${SEASON_YEAR}:${week}`;
  let resource = resources.get(key);
  if (!resource) {
    resource = createResource<LiveDataPayload | null>(async (signal) => {
      const response = await fetch(`/api/live?week=${week}`, { signal });
      if (!response.ok) throw new Error(`/api/live failed: ${response.status}`);
      const payload = payloadSchema.parse(await response.json());
      if (payload.week !== null && payload.week !== week) throw new Error('Live scoring week mismatch');
      return {
        data: payload.week === null ? null : payload,
        ...resourceSource(payload),
      };
    }, { ttlMs: 45_000, pollMs: 60_000 });
    resources.set(key, resource);
  }
  return resource;
}

export function getCachedLiveData(week: number): Promise<LiveDataPayload | null> {
  return getLiveResource(week).read();
}

export function getLiveData(week: number): Promise<LiveDataPayload | null> {
  return getCachedLiveData(week);
}

export async function getWeekPlayerStats(week: number): Promise<Map<string, PlayerStats>> {
  const payload = await getCachedLiveData(week);
  return new Map((payload?.stats ?? []).map(stat => [stat.playerId, stat]));
}
