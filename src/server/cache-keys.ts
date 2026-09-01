/**
 * Cache keys for the `data_cache` table.
 * Shared by the refresh scripts (writers) and the /api/* handlers (readers).
 */

export const playersCacheKey = (year: number) => `players-${year}`;
export const schedulesCacheKey = (year: number) => `schedules-${year}`;
export const teamsCacheKey = (year: number) => `teams-${year}`;
export const seasonStatsCacheKey = (year: number) => `player-season-stats-${year}`;
/** Live data is stored per week so completed weeks are never overwritten. */
export const liveStatsCacheKey = (year: number, week: number) => `live-stats-${year}-week-${week}`;
