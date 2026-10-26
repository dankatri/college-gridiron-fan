/**
 * Divisions ("classification" in CollegeFootballData terms) the player pool can
 * be drawn from.
 *
 * The pick'em shipped FBS-only. FCS is opt-in rather than automatic, so every
 * data path takes an explicit division list and a season can be refreshed for
 * one division or both without a second pipeline. This module is pure so the
 * browser can label a player's division; the opt-in itself is read server-side
 * in `src/server/classifications.ts`.
 */

export const CLASSIFICATIONS = ['fbs', 'fcs'] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  fbs: 'FBS',
  fcs: 'FCS',
};

/** Divisions used when nothing opts in to more. */
export const DEFAULT_CLASSIFICATIONS: readonly Classification[] = ['fbs'];

export function isClassification(value: unknown): value is Classification {
  return typeof value === 'string' && (CLASSIFICATIONS as readonly string[]).includes(value);
}

/**
 * Parses a comma-separated division list such as `"fbs,fcs"`.
 *
 * A missing or blank value falls back to the default. An unrecognised division
 * throws instead of being dropped: quietly refreshing FBS-only would be
 * indistinguishable from the opt-in not working at all.
 */
export function parseClassifications(raw: string | undefined | null): Classification[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return [...DEFAULT_CLASSIFICATIONS];

  const unknown = entries.filter((entry) => !isClassification(entry));
  if (unknown.length) {
    throw new Error(
      `Unknown division(s): ${unknown.join(', ')}. Supported divisions: ${CLASSIFICATIONS.join(', ')}`,
    );
  }

  // Return in CLASSIFICATIONS order so callers get a stable, deduplicated list.
  return CLASSIFICATIONS.filter((classification) => entries.includes(classification));
}

/** `true` when the list covers more than the historical FBS-only pool. */
export function includesFcs(classifications: readonly Classification[]): boolean {
  return classifications.includes('fcs');
}
