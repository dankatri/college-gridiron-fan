/**
 * Shape of the offline snapshot shared by the preview builder
 * (scripts/dev-snapshot.ts) and the preview API (scripts/lib/dev-api.ts).
 *
 * Local development only: nothing here is deployed or served in production.
 */

import { resolve } from 'node:path';

import type { Classification } from '../../src/lib/classification';
import type { Player, TeamSchedule } from '../../src/lib/types';
import type { SeasonStatsPayload } from '../../src/lib/season-stats';

/** Gitignored, so a multi-megabyte preview pull never reaches a commit. */
export const SNAPSHOT_PATH = resolve(process.cwd(), '.dev-preview/snapshot.json');

export type DevTeamSummary = {
  id: string;
  school: string;
  conference: string;
  classification: Classification | null;
  logo: string | null;
  color: string | null;
  alternateColor: string | null;
};

export type DevSnapshot = {
  generatedAt: string;
  season: number;
  projectionYear: number;
  divisions: Classification[];
  players: Player[];
  teams: DevTeamSummary[];
  schedules: TeamSchedule[];
  seasonStats: SeasonStatsPayload;
};
