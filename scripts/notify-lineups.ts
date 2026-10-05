/**
 * Emails league members who have not finished their lineup for the open week.
 *
 * Runs twice a week (Thursday and Saturday mornings) from GitHub Actions, in
 * the same place as the data refreshes, because it needs the Resend key and a
 * long-lived runtime rather than an edge function.
 *
 * Two guarantees shape this script:
 *  - a member is mailed at most once per week per stage, enforced by the
 *    primary key of `lineup_reminders`, not by the cron firing exactly once;
 *  - the dedup row is written only after Resend has accepted the message, so a
 *    failed send is retried rather than silently swallowed.
 */

import { SEASON_YEAR, WEEK_LABELS, weekForDate } from '../src/lib/season-config';
import { projectCompletedGameWeeks, projectNextKickoff } from '../src/server/cache-projections';
import {
  REQUIRED_SLOTS,
  buildReminderDigests,
  describeKickoff,
  isReminderStage,
  isRemindableWeek,
  projectPendingLineups,
  type ReminderDigest,
  type ReminderRow,
  type ReminderStage,
} from '../src/server/lineup-reminders';
import { lineupReminderEmail, sendEmail } from '../src/server/mailer';
import { lineupReminders } from '../src/server/schema';
import { logStep, requireEnv, runScript } from './lib/runner';

function appUrl(path: string): string {
  return `${requireEnv('APP_URL').replace(/\/+$/, '')}${path}`;
}

await runScript('notify-lineups', async () => {
  requireEnv('DATABASE_URL');
  requireEnv('APP_URL');
  const dryRun = process.env.DRY_RUN === '1';
  if (!dryRun) requireEnv('RESEND_API_KEY');

  const stage = process.env.REMINDER_STAGE ?? '';
  if (!isReminderStage(stage)) {
    throw new Error(`REMINDER_STAGE must be one of thursday, saturday (got "${stage}")`);
  }

  const { db } = await import('../src/server/db');
  const now = new Date();
  const week = weekForDate(now);
  const finals = await db.execute<{ week: number }>(projectCompletedGameWeeks(SEASON_YEAR));
  const gameFinals = new Set(finals.rows.map(row => Number(row.week)));

  if (!isRemindableWeek(week, now, gameFinals)) {
    logStep('no open week to remind about', { week, stage });
    return;
  }

  const pending = await db.execute<ReminderRow>(projectPendingLineups(SEASON_YEAR, week, stage));
  const digests = buildReminderDigests(pending.rows.map(row => ({ ...row, filledSlots: Number(row.filledSlots) })));
  logStep('reminder scope', {
    week, stage, dryRun, memberships: pending.rows.length, recipients: digests.length,
  });
  if (!digests.length) return;

  const kickoffRow = await db.execute<{ kickoff: string | null }>(projectNextKickoff(SEASON_YEAR, week));
  const kickoff = describeKickoff(kickoffRow.rows[0]?.kickoff ? new Date(kickoffRow.rows[0].kickoff!) : null);
  const weekLabel = WEEK_LABELS[week] ?? `Week ${week}`;

  const failures: string[] = [];
  for (const digest of digests) {
    try {
      await deliver(db, digest, { week, stage, weekLabel, kickoff, dryRun });
    } catch (error) {
      failures.push(digest.userId);
      console.error(`Reminder for ${digest.userId} failed; it will be retried on the next run`, error);
    }
  }

  logStep('reminders sent', { week, stage, sent: digests.length - failures.length, failed: failures.length });
  if (failures.length) throw new Error(`${failures.length} reminder(s) could not be delivered`);
});

async function deliver(
  db: Awaited<typeof import('../src/server/db')>['db'],
  digest: ReminderDigest,
  context: { week: number; stage: ReminderStage; weekLabel: string; kickoff: string | null; dryRun: boolean },
): Promise<void> {
  const message = lineupReminderEmail({
    displayName: digest.displayName,
    weekLabel: context.weekLabel,
    leagues: digest.leagues,
    requiredSlots: REQUIRED_SLOTS,
    lineupUrl: appUrl('/'),
    unsubscribeUrl: appUrl(`/api/notifications/unsubscribe?token=${encodeURIComponent(digest.notifyToken)}`),
    kickoff: context.kickoff,
    urgent: context.stage === 'saturday',
  });

  if (context.dryRun) {
    logStep('would email', {
      to: digest.email, subject: message.subject,
      leagues: digest.leagues.map(league => `${league.leagueName}:${league.filledSlots}/${REQUIRED_SLOTS}`),
    });
    return;
  }

  await sendEmail({ ...message, to: digest.email });
  // Recorded only after delivery: a claim made before the send would silence a
  // member whose mail never actually went out.
  await db.insert(lineupReminders).values({
    userId: digest.userId,
    season: SEASON_YEAR,
    week: context.week,
    stage: context.stage,
    leagueCount: digest.leagues.length,
  }).onConflictDoNothing();
}
