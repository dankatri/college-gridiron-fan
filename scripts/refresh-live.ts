import { beginCacheRun } from './lib/cache';
import { loadGameContext, refreshLiveWeeks } from './lib/refresh-football';
import { refreshWeeks } from './lib/refresh-policy';
import { requireEnv, runScript } from './lib/runner';

await runScript('refresh-live', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');
  const forced = process.env.WEEK;
  if (forced !== undefined && !/^\d+$/.test(forced)) throw new Error('WEEK must be a configured week number');
  const forcedWeek = forced === undefined ? undefined : Number(forced);
  const now = new Date();
  refreshWeeks([], now, true, forcedWeek);
  const run = await beginCacheRun();
  const { games } = await loadGameContext();
  await refreshLiveWeeks(run, games, new Date(), true, forcedWeek);
});
