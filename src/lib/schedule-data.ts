import { TeamSchedule, WeeklyGame } from './types';

// Cache for team schedules
const scheduleCache: Map<string, TeamSchedule> = new Map();
let cacheTimestamp: number = 0;
let inFlight: Promise<TeamSchedule[]> | null = null;
// Schedules carry completion flags that change during play, so this is short
// enough for a page left open to notice games finishing. Deliberately under the
// 60s useWeekLocks poll: at exactly 60s the cache can still be marginally valid
// when the timer fires, silently stretching the refresh to two minutes.
const CACHE_DURATION = 1000 * 45; // 45 seconds

/**
 * Clear the schedule cache to force fresh data
 */
export function clearScheduleCache() {
  scheduleCache.clear();
  cacheTimestamp = 0;
  inFlight = null;
  console.log('Schedule cache cleared');
}

/**
 * Check if schedule cache is valid
 */
function isScheduleCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_DURATION;
}

/** Game dates survive JSON transport as ISO strings; restore them as Dates. */
function reviveSchedule(raw: TeamSchedule): TeamSchedule {
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
  if (scheduleCache.size > 0 && isScheduleCacheValid()) {
    return Array.from(scheduleCache.values());
  }

  // Several callers ask for schedules at once on first paint; share one request.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch('/api/schedules');
      if (!response.ok) {
        throw new Error(`/api/schedules failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const raw = Array.isArray(payload?.schedules) ? (payload.schedules as TeamSchedule[]) : [];
      const schedules = raw.map(reviveSchedule);

      scheduleCache.clear();
      for (const schedule of schedules) {
        scheduleCache.set(schedule.teamId, schedule);
      }
      cacheTimestamp = Date.now();

      console.log(`Loaded schedules for ${schedules.length} teams`);
      return schedules;
    } catch (error) {
      console.error('Failed to load team schedules:', error);
      return [];
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

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
