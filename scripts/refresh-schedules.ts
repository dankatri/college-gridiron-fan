import { beginCacheRun } from './lib/cache';
import { refreshSchedules } from './lib/refresh-football';
import { requireEnv, runScript } from './lib/runner';

await runScript('refresh-schedules', async () => {
  requireEnv('CFBD_API_KEY');
  requireEnv('DATABASE_URL');
  await refreshSchedules(await beginCacheRun());
});
