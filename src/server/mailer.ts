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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
