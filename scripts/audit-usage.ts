import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { SEASON_YEAR } from '../src/lib/season-config';
import { lineups, playerUsage } from '../src/server/schema';
import { toUsageMap } from '../src/server/lineup-utils';
import { lockLineupMember, replaceUsage } from '../src/server/lineup-storage';
import { withLineupTransaction } from '../src/server/lineup-transaction';
import { logStep, requireEnv, runScript } from './lib/runner';

await runScript('audit-usage', async () => {
  requireEnv('DATABASE_URL');
  const leagueId = z.string().uuid().parse(requireEnv('LEAGUE_ID'));
  const userId = z.string().uuid().parse(requireEnv('MEMBER_ID'));
  const apply = process.env.APPLY === '1';
  if (process.env.APPLY && !apply) throw new Error('APPLY must be 1 to reconcile; omit it for a dry run');
  await withLineupTransaction(async tx => {
    await lockLineupMember(tx, leagueId, userId, 404);
    const saved = await tx.select({ slots: lineups.slots }).from(lineups).where(and(
      eq(lineups.leagueId, leagueId), eq(lineups.userId, userId), eq(lineups.season, SEASON_YEAR),
    ));
    const cached = await tx.select({ playerId: playerUsage.playerId, timesUsed: playerUsage.timesUsed })
      .from(playerUsage).where(and(eq(playerUsage.leagueId, leagueId), eq(playerUsage.userId, userId), eq(playerUsage.season, SEASON_YEAR)));
    const actual = toUsageMap(saved);
    const existing = new Map(cached.map(row => [row.playerId, row.timesUsed]));
    const differences = [...new Set([...actual.keys(), ...existing.keys()])]
      .filter(id => (actual.get(id) ?? 0) !== (existing.get(id) ?? 0))
      .map(playerId => ({ playerId, cached: existing.get(playerId) ?? 0, actual: actual.get(playerId) ?? 0 }));
    logStep('usage comparison', { apply, season: SEASON_YEAR, differences });
    if (apply && differences.length) await replaceUsage(tx, leagueId, userId, actual);
  });
});
