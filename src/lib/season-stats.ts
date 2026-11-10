import { z } from 'zod';
import { sourceMetadataFields } from './source-metadata';

/**
 * Only the fields that are summed across weeks. Kept separate from the player
 * record below so a non-additive field can never leak into SEASON_STAT_FIELDS,
 * which drives both the SQL sums and the zero-filled test fixtures.
 */
const seasonStatTotalsSchema = z.object({
  fantasyPoints: z.number().finite(),
  passingYards: z.number().finite(),
  passingTDs: z.number().finite(),
  completions: z.number().finite(),
  attempts: z.number().finite(),
  interceptions: z.number().finite(),
  rushingYards: z.number().finite(),
  rushingTDs: z.number().finite(),
  receivingYards: z.number().finite(),
  receptions: z.number().finite(),
  receivingTDs: z.number().finite(),
  kickReturnYards: z.number().finite(),
  puntReturnYards: z.number().finite(),
});

export const SEASON_STAT_FIELDS = seasonStatTotalsSchema.keyof().options;

export const seasonPlayerStatsSchema = seasonStatTotalsSchema.extend({
  playerId: z.string().min(1),
  /**
   * Latest week this player recorded a stat line, or null when they never did.
   * Optional so snapshots written before this field still parse.
   */
  lastPlayedWeek: z.number().int().nullable().optional(),
});
export type SeasonPlayerStats = z.infer<typeof seasonPlayerStatsSchema>;
export type SeasonStatKey = typeof SEASON_STAT_FIELDS[number] | 'returnYards';

export const seasonStatsSchema = z.object({
  season: z.number().int(),
  stats: z.array(seasonPlayerStatsSchema),
  availableWeeks: z.array(z.number().int()),
  missingWeeks: z.array(z.number().int()),
  updatedAt: z.string().nullable(),
}).merge(sourceMetadataFields);
export type SeasonStatsPayload = z.infer<typeof seasonStatsSchema>;

export function seasonStatValue(
  stats: SeasonPlayerStats | undefined,
  key: SeasonStatKey,
  complete: boolean,
): number | undefined {
  if (!stats) return complete ? 0 : undefined;
  return key === 'returnYards' ? stats.kickReturnYards + stats.puntReturnYards : stats[key];
}
