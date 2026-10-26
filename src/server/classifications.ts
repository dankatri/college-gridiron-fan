/**
 * Server-only resolution of which divisions the refresh jobs publish.
 *
 * SERVER-ONLY. Never import from `src/lib` or components: the browser must
 * learn a player's division from the cached payload, not from an env var that
 * could disagree with the data that was actually published.
 *
 * Set `INCLUDED_DIVISIONS=fbs,fcs` to include FCS. Unset means FBS-only, which
 * is the behaviour every existing deployment already has.
 */

import { parseClassifications, type Classification } from '../lib/classification';

export const INCLUDED_DIVISIONS_ENV = 'INCLUDED_DIVISIONS';

export function includedClassifications(
  env: Record<string, string | undefined> = process.env,
): Classification[] {
  return parseClassifications(env[INCLUDED_DIVISIONS_ENV]);
}
