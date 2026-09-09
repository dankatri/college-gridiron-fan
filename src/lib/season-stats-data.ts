import { createResource } from './async-resource';
import { SEASON_YEAR } from './season-config';
import { seasonStatsSchema, type SeasonStatsPayload } from './season-stats';
import { resourceSource } from './source-metadata';

export const seasonStatsResource = createResource<SeasonStatsPayload>(async signal => {
  const response = await fetch('/api/season-stats', { signal });
  if (!response.ok) throw new Error(`/api/season-stats failed: ${response.status}`);
  const payload = seasonStatsSchema.parse(await response.json());
  if (payload.season !== SEASON_YEAR) throw new Error('Season stats year mismatch');
  return { data: payload, ...resourceSource(payload) };
}, { ttlMs: 45_000, pollMs: 60_000 });
