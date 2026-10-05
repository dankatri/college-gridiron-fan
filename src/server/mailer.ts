/**
 * Transactional email delivery via the Resend HTTP API.
 *
 * Uses plain fetch so it runs on the Vercel Edge runtime (no SMTP client).
 * Requires RESEND_API_KEY; MAIL_FROM overrides the default sender.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'College Gridiron Fan <noreply@mail.dkatri.xyz>';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra RFC 5322 headers, e.g. one-click unsubscribe. */
  headers?: Record<string, string>;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend request failed with ${response.status}: ${detail}`);
  }
}

export function passwordResetEmail(displayName: string, resetUrl: string, ttlMinutes: number): Omit<EmailMessage, 'to'> {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset your College Gridiron Fan password',
    text: [
      `Hi ${displayName},`,
      '',
      'We received a request to reset your College Gridiron Fan password.',
      `Open this link to choose a new one (it expires in ${ttlMinutes} minutes):`,
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email — your password will not change.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 16px">Reset your password</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your College Gridiron Fan password.</p>
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            Choose a new password
          </a>
        </p>
        <p style="color:#555;font-size:14px">This link expires in ${ttlMinutes} minutes and can only be used once.</p>
        <p style="color:#555;font-size:14px">
          If you did not request this, you can safely ignore this email — your password will not change.
        </p>
        <p style="color:#888;font-size:12px;word-break:break-all">${safeUrl}</p>
      </div>
    `,
  };
}

export interface LineupReminder {
  displayName: string;
  weekLabel: string;
  /** Leagues still missing players, with how many of the six slots are filled. */
  leagues: ReadonlyArray<{ leagueName: string; filledSlots: number }>;
  requiredSlots: number;
  lineupUrl: string;
  unsubscribeUrl: string;
  /** Local-time description of the next kickoff, when one is known. */
  kickoff: string | null;
  /** The later nudge is more urgent because games are already under way. */
  urgent: boolean;
}

/**
 * The "you have not picked a team yet" nudge.
 *
 * Says exactly which leagues are outstanding and how far along each one is, so
 * someone who half-filled a lineup is not told they have done nothing.
 */
export function lineupReminderEmail(reminder: LineupReminder): Omit<EmailMessage, 'to'> {
  const { displayName, weekLabel, leagues, requiredSlots, lineupUrl, unsubscribeUrl, kickoff, urgent } = reminder;
  const many = leagues.length > 1;
  const subject = urgent
    ? `Last call: your ${weekLabel} lineup is not set`
    : `${weekLabel} is open — your lineup is not set`;

  const describe = (league: { leagueName: string; filledSlots: number }) =>
    league.filledSlots === 0
      ? `${league.leagueName} — no players picked`
      : `${league.leagueName} — ${league.filledSlots} of ${requiredSlots} slots filled`;

  const opening = many
    ? `You have ${leagues.length} leagues without a finished ${weekLabel} lineup:`
    : `Your ${weekLabel} lineup is not finished yet:`;
  const timing = kickoff
    ? `The next kickoff is ${kickoff}, and each slot locks when that player's own game starts.`
    : "Each slot locks when that player's own game kicks off.";

  return {
    subject,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    text: [
      `Hi ${displayName},`,
      '',
      opening,
      ...leagues.map(league => `  - ${describe(league)}`),
      '',
      timing,
      '',
      `Pick your team: ${lineupUrl}`,
      '',
      `Stop these reminders: ${unsubscribeUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 16px">${escapeHtml(weekLabel)}: your lineup is not set</h2>
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>${escapeHtml(opening)}</p>
        <ul>
          ${leagues.map(league => `<li>${escapeHtml(describe(league))}</li>`).join('')}
        </ul>
        <p style="margin:24px 0">
          <a href="${escapeHtml(lineupUrl)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            Pick your team
          </a>
        </p>
        <p style="color:#555;font-size:14px">${escapeHtml(timing)}</p>
        <p style="color:#888;font-size:12px">
          You are getting this because lineup reminders are on for your account.
          <a href="${escapeHtml(unsubscribeUrl)}">Stop these reminders</a>.
        </p>
      </div>
    `,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
