import { schedulesCacheKey } from '../../src/server/cache-keys';
import { projectScheduleGate } from '../../src/server/cache-projections';
import { publishedCacheSnapshot } from '../../src/server/read-published-cache';
import type { ScheduleGate } from './refresh-policy';

interface ScheduleGateRow {
  [column: string]: unknown;
  key: string;
  data: unknown;
  revision: string;
  present: boolean | null;
  malformed: boolean | null;
  kickoffs: string[] | null;
}

/**
 * Reads the discovery gate for a season. The source metadata still arrives
 * whole because it is a handful of fields, but the schedule itself never
 * leaves the database.
 */
export async function readScheduleGate(year: number) {
  const { db } = await import('../../src/server/db');
  const key = schedulesCacheKey(year);
  const result = await db.execute<ScheduleGateRow>(projectScheduleGate(year));
  const rows = result.rows.map(row => ({
    key: row.key,
    data: row.data,
    // revision is updated_at rendered as UTC, so it dates the row without
    // depending on how the driver returns a bare timestamp.
    updatedAt: new Date(row.revision),
    revision: row.revision,
  }));
  const facts = result.rows[0];
  const gate: ScheduleGate = {
    present: facts?.present ?? false,
    malformed: facts?.malformed ?? false,
    kickoffs: facts?.kickoffs ?? [],
  };
  return { ...publishedCacheSnapshot<never>(key, rows), gate };
}
