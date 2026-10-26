/**
 * Which divisions may be picked in which week.
 *
 * Week 9 is Halloween week: an FCS-only slate, and the only week FCS players
 * are ever selectable. The rule is expressed as a per-week allow-list rather
 * than a "week 9 is special" exception because both halves matter — once the
 * cached pool contains FCS players so week 9 can work at all, every *other*
 * week has to actively exclude them. One table gives both guarantees.
 */

import type { Classification } from './classification';
import type { Player } from './types';

/** The one week drawn from FCS instead of FBS. */
export const FCS_WEEK = 9;

const FCS_ONLY: readonly Classification[] = ['fcs'];
const FBS_ONLY: readonly Classification[] = ['fbs'];

/** The divisions a lineup for `week` may be drawn from. */
export function divisionsForWeek(week: number): readonly Classification[] {
  return week === FCS_WEEK ? FCS_ONLY : FBS_ONLY;
}

/**
 * A player's division for eligibility purposes.
 *
 * `classification` is optional: it postdates the FBS-only pool, so snapshots
 * cached before it existed omit it entirely. Those players are FBS, and
 * treating an absent field as "unknown, therefore ineligible" would empty
 * every lineup the moment an older snapshot is served.
 */
export function divisionOf(player: Pick<Player, 'classification'>): Classification {
  return player.classification ?? 'fbs';
}

export function isPlayerEligibleForWeek(player: Pick<Player, 'classification'>, week: number): boolean {
  return divisionsForWeek(week).includes(divisionOf(player));
}

/** `true` when `week` departs from the usual FBS slate. */
export function isFcsWeek(week: number): boolean {
  return week === FCS_WEEK;
}
