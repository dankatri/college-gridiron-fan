import { isPlayedLineup } from './lineup-utils';

type ScoringLineup = {
  userId: string;
  week: number;
  slots: ReadonlyArray<{ playerId: string | null }>;
  projectedPoints: string | null;
};

type LineupTotals = {
  totalPoints: number;
  weeklyPoints: Record<number, number>;
  projectedPoints: Record<number, number>;
  weeksScored: number;
};

export function scoreLineups(
  lineups: ReadonlyArray<ScoringLineup>,
  weeklyScores: ReadonlyMap<number, ReadonlyMap<string, number>>,
  startedWeeks: ReadonlySet<number>,
  now: Date,
) {
  const totals = new Map<string, LineupTotals>();
  const scoredWeeks = new Set<number>();

  for (const row of lineups) {
    const existing = totals.get(row.userId) ?? {
      totalPoints: 0, weeklyPoints: {}, projectedPoints: {}, weeksScored: 0,
    };
    existing.projectedPoints[row.week] = Number.parseFloat(row.projectedPoints ?? '0') || 0;

    // An editable week is not participation until play begins; closed weeks retain zero-score entries.
    if (isPlayedLineup(row, startedWeeks.has(row.week), now)) {
      const weekScores = weeklyScores.get(row.week);
      const points = row.slots.reduce((sum, slot) => sum + (slot.playerId ? weekScores?.get(slot.playerId) ?? 0 : 0), 0);
      existing.totalPoints += points;
      existing.weeklyPoints[row.week] = Number(points.toFixed(2));
      existing.weeksScored += 1;
      scoredWeeks.add(row.week);
    }
    totals.set(row.userId, existing);
  }

  return { totals, scoredWeeks };
}
