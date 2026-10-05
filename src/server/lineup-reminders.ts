/**
 * Who still needs to be told to pick a team this week.
 *
 * The decision is deliberately split from delivery: everything here is pure,
 * so the rules that govern who gets mailed are testable without a database or
 * a mail provider. `scripts/notify-lineups.ts` does the I/O around it.
 */

import { sql } from 'drizzle-orm';
import { LINEUP_REQUIREMENTS } from '../lib/types';
import { isWeekComplete, hasWeekStarted } from '../lib/week-lock';
import { weekBoundary } from '../lib/season-config';

/** How many slots a finished lineup has. */
export const REQUIRED_SLOTS = Object.values(LINEUP_REQUIREMENTS).reduce((sum, count) => sum + count, 0);

/**
 * The two nudges in a week. A stage is part of the dedup key, so each member
 * can receive each stage at most once per week.
 */
export const REMINDER_STAGES = ['thursday', 'saturday'] as const;
export type ReminderStage = typeof REMINDER_STAGES[number];

export function isReminderStage(value: string): value is ReminderStage {
  return (REMINDER_STAGES as readonly string[]).includes(value);
}

/** One league a member has left unfinished, as returned by the projection. */
export interface ReminderRow {
  [column: string]: unknown;
  userId: string;
  email: string;
  displayName: string;
  notifyToken: string;
  leagueId: string;
  leagueName: string;
  filledSlots: number;
}

export interface ReminderDigest {
  userId: string;
  email: string;
  displayName: string;
  notifyToken: string;
  leagues: Array<{ leagueId: string; leagueName: string; filledSlots: number }>;
}

/**
 * A week is worth reminding about only while something can still be changed.
 * Outside the season, or once the slate is settled, there is nothing to ask
 * for and the mail would only be noise.
 */
export function isRemindableWeek(
  week: number | null,
  now: Date,
  gameFinals?: ReadonlySet<number>,
): week is number {
  if (week === null) return false;
  if (!weekBoundary(week)) return false;
  return hasWeekStarted(week, now) && !isWeekComplete(week, now, gameFinals);
}

/**
 * Collapses per-league rows into one digest per member.
 *
 * Someone in three leagues gets a single mail listing all three rather than
 * three near-identical ones, which is also what makes the dedup key per user
 * rather than per membership.
 */
export function buildReminderDigests(rows: readonly ReminderRow[]): ReminderDigest[] {
  const digests = new Map<string, ReminderDigest>();

  for (const row of rows) {
    if (!row.email) continue;
    let digest = digests.get(row.userId);
    if (!digest) {
      digest = {
        userId: row.userId,
        email: row.email,
        displayName: row.displayName,
        notifyToken: row.notifyToken,
        leagues: [],
      };
      digests.set(row.userId, digest);
    }
    if (digest.leagues.some(league => league.leagueId === row.leagueId)) continue;
    digest.leagues.push({
      leagueId: row.leagueId,
      leagueName: row.leagueName,
      filledSlots: row.filledSlots,
    });
  }

  for (const digest of digests.values()) {
    digest.leagues.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  }

  return [...digests.values()];
}

/**
 * Members with an unfinished lineup for this week who have not already had
 * this stage's mail.
 *
 * Counting the filled slots in SQL keeps the read to one short row per
 * outstanding membership instead of shipping every stored lineup out of the
 * database, the same reason the cache reads are projected.
 */
export function projectPendingLineups(season: number, week: number, stage: ReminderStage) {
  return sql`
    select u.id as "userId", u.email, u.display_name as "displayName",
      u.notify_token as "notifyToken", lg.id as "leagueId", lg.name as "leagueName",
      coalesce(filled.count, 0) as "filledSlots"
    from league_members m
    join leagues lg on lg.id = m.league_id and lg.season = ${season}
    join users u on u.id = m.user_id
    left join lineups ln on ln.league_id = m.league_id and ln.user_id = m.user_id
      and ln.season = ${season} and ln.week = ${week}
    left join lateral (
      select count(*)::int as count
      from jsonb_array_elements(
        case when jsonb_typeof(ln.slots) = 'array' then ln.slots else '[]'::jsonb end
      ) slot
      where nullif(slot.value->>'playerId', '') is not null
    ) filled on true
    where u.lineup_reminders_enabled = 1
      and coalesce(filled.count, 0) < ${REQUIRED_SLOTS}
      and not exists (
        select 1 from lineup_reminders r
        where r.user_id = u.id and r.season = ${season}
          and r.week = ${week} and r.stage = ${stage}
      )
    order by u.id, lg.name`;
}

/** Kickoffs read far better as "Saturday, Oct 3, 3:30 PM ET" than as an ISO string. */
export function describeKickoff(kickoff: Date | null): string | null {
  if (!kickoff || Number.isNaN(kickoff.getTime())) return null;
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(kickoff);
  return `${formatted} ET`;
}
