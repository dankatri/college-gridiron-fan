import { and, eq } from 'drizzle-orm';
import { leagueMembers, playerUsage } from './schema';
import { SEASON_YEAR } from '../lib/season-config';
import { HttpError } from './http';
import type { LineupTransaction } from './lineup-transaction';

export async function lockLineupMember(tx: LineupTransaction, leagueId: string, userId: string, missingStatus = 403) {
  const [member] = await tx.select({ userId: leagueMembers.userId }).from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId))).for('update');
  if (!member) throw new HttpError(missingStatus, 'That member is not in this league');
}

/** Caller must hold lockLineupMember in this same transaction. */
export async function replaceUsage(tx: LineupTransaction, leagueId: string, userId: string, usage: Map<string, number>) {
  await tx.delete(playerUsage).where(and(
    eq(playerUsage.leagueId, leagueId), eq(playerUsage.userId, userId), eq(playerUsage.season, SEASON_YEAR),
  ));
  const rows = [...usage].map(([playerId, timesUsed]) => ({
    leagueId, userId, season: SEASON_YEAR, playerId, timesUsed,
  }));
  if (rows.length) await tx.insert(playerUsage).values(rows);
  return rows.map(({ playerId, timesUsed }) => ({ playerId, timesUsed }));
}
