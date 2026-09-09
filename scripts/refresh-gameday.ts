import { SEASON_YEAR } from '../src/lib/season-config';
import { schedulesCacheKey } from '../src/server/cache-keys';
import { readPublishedCache } from '../src/server/read-published-cache';
import type { TeamSchedule } from '../src/lib/types';
import { beginCacheRun } from './lib/cache';
import { loadGameContext, refreshLiveWeeks, refreshSchedules } from './lib/refresh-football';
import { shouldDiscover } from './lib/refresh-policy';
import { logStep, requireEnv, runScript } from './lib/runner';

await runScript('refresh-gameday', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');
  const now = new Date();
  const sweep = process.env.DISCOVERY_SWEEP === '1';
  const schedule = await readPublishedCache<TeamSchedule[]>(schedulesCacheKey(SEASON_YEAR));
  if (!shouldDiscover(schedule.data, schedule.sourceStatus === 'ready' ? schedule.sourceCheckedAt : null, now, sweep)) {
    logStep('no active game window; hourly safety discovery remains scheduled');
    return;
  }
  const run = await beginCacheRun();
  const context = await loadGameContext();
  // One source discovery is shared, but a failed schedule publication must not
  // suppress independently valid live weeks.
  const results = await Promise.allSettled([
    refreshSchedules(run, context), refreshLiveWeeks(run, context.games, new Date(), sweep),
  ]);
  for (const result of results) if (result.status === 'rejected') console.error('Gameday refresh branch failed', result.reason);
  if (results.some(result => result.status === 'rejected')) throw new Error('Gameday refresh was incomplete');
});
