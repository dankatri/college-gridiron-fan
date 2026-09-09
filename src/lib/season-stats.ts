import { z } from 'zod';
import { sourceMetadataFields } from './source-metadata';

export const seasonPlayerStatsSchema = z.object({
  playerId: z.string().min(1),
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

export const SEASON_STAT_FIELDS = seasonPlayerStatsSchema.omit({ playerId: true }).keyof().options;
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
