import { TeamSchedule, WeeklyGame } from './types';
import { z } from 'zod';
import { createResource } from './async-resource';
import { sourceMetadataFields, resourceSource } from './source-metadata';

// Cache for team schedules
// Schedules carry completion flags that change during play, so this is short
// enough for a page left open to notice games finishing. Deliberately under the
// 60s useWeekLocks poll: at exactly 60s the cache can still be marginally valid
// when the timer fires, silently stretching the refresh to two minutes.
const CACHE_DURATION = 1000 * 45; // 45 seconds

/**
 * Clear the schedule cache to force fresh data
 */
export function clearScheduleCache() {
  schedulesResource.invalidate();
}

/**
 * Check if schedule cache is valid
 */
const schedulePayload = z.object({
  updatedAt: z.string().nullable(),
  schedules: z.array(z.object({
    teamId: z.string(), teamName: z.string(), conference: z.string(),
    byeWeeks: z.array(z.number().int()),
    weeklyGames: z.array(z.object({
      week: z.number().int(), isHomeGame: z.boolean(), isByeWeek: z.boolean(),
      gameDate: z.string().datetime({ offset: true }).optional(),
      opponent: z.string().optional(), gameTime: z.string().optional(),
      gameId: z.string().optional(), isCompleted: z.boolean().optional(),
      teamPoints: z.number().optional(), opponentPoints: z.number().optional(),
    }).passthrough()),
  }).passthrough()).nonempty('Schedules are not available yet. Please retry.'),
}).merge(sourceMetadataFields);

/** Game dates survive JSON transport as ISO strings; restore them as Dates. */
function reviveSchedule(raw: z.infer<typeof schedulePayload>['schedules'][number]): TeamSchedule {
  return {
    ...raw,
    byeWeeks: raw.byeWeeks ?? [],
    weeklyGames: (raw.weeklyGames ?? []).map((game): WeeklyGame => ({
      ...game,
      gameDate: game.gameDate ? new Date(game.gameDate) : undefined,
    })),
  };
}

/**
 * Fetch team schedules from the server cache (populated from CollegeFootballData
 * by scripts/refresh-schedules.ts). The CFBD key is server-only, so the browser
 * never talks to the upstream API directly.
 */
export async function getTeamSchedules(): Promise<TeamSchedule[]> {
  return schedulesResource.read();
}

export const schedulesResource = createResource<TeamSchedule[]>(async (signal) => {
  const response = await fetch('/api/schedules', { signal });
  if (!response.ok) throw new Error(`/api/schedules failed: ${response.status}`);
  const payload = schedulePayload.parse(await response.json());
  return {
    data: payload.schedules.map(reviveSchedule),
    ...resourceSource(payload),
  };
}, { ttlMs: CACHE_DURATION, pollMs: 60_000 });

/**
 * Get schedule for a specific team
 */
export async function getTeamSchedule(teamName: string): Promise<TeamSchedule | null> {
  const schedules = await getTeamSchedules();
  const target = teamName.toLowerCase();

  return (
    schedules.find(s => s.teamName.toLowerCase() === target) ??
    schedules.find(s =>
      s.teamName.toLowerCase().includes(target) || target.includes(s.teamName.toLowerCase()),
    ) ??
    null
  );
}

/**
 * Check if a team has a bye week in a specific week
 */
export async function isTeamOnBye(teamName: string, week: number): Promise<boolean> {
  const schedule = await getTeamSchedule(teamName);
  return schedule?.byeWeeks.includes(week) || false;
}

/**
 * Get all teams on bye for a specific week
 */
export async function getTeamsOnBye(week: number): Promise<string[]> {
  const schedules = await getTeamSchedules();
  return schedules
    .filter(schedule => schedule.byeWeeks.includes(week))
    .map(schedule => schedule.teamName);
}

/**
 * Get opponent for a team in a specific week
 */
export async function getTeamOpponent(teamName: string, week: number): Promise<string | null> {
  const schedule = await getTeamSchedule(teamName);
  const weekGame = schedule?.weeklyGames.find(game => game.week === week);
  return weekGame?.opponent || null;
}
