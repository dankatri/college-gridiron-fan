import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { passwordResetTokens, users } from '../../src/server/schema';
import { passwordResetEmail, sendEmail } from '../../src/server/mailer';
import {
  RESET_TOKEN_RESEND_INTERVAL_MS,
  RESET_TOKEN_TTL_MS,
  buildResetUrl,
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
} from '../../src/server/password-reset';

export const config = {
  runtime: 'edge',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ForgotPasswordBody = {
  email?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Always identical, so the endpoint never reveals whether an account exists.
const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an account exists for that email, we have sent a password reset link.',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: ForgotPasswordBody;
  try {
    body = (await request.json()) as ForgotPasswordBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: 'Please provide a valid email address' }, 400);
  }

  try {
    const rows = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return jsonResponse(GENERIC_RESPONSE);
    }

    // Throttle: skip if a still-valid token was minted moments ago.
    const recent = await db
      .select({ createdAt: passwordResetTokens.createdAt })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gt(passwordResetTokens.createdAt, new Date(Date.now() - RESET_TOKEN_RESEND_INTERVAL_MS)),
        ),
      )
      .limit(1);

    if (recent.length > 0) {
      return jsonResponse(GENERIC_RESPONSE);
    }

    const token = generateResetToken();
    const tokenHash = await hashResetToken(token);

    await db.insert(passwordResetTokens).values({
      tokenHash,
      userId: user.id,
      expiresAt: resetTokenExpiry(),
    });

    const message = passwordResetEmail(
      user.displayName,
      buildResetUrl(token),
      Math.round(RESET_TOKEN_TTL_MS / 60000),
    );
    await sendEmail({ to: user.email, ...message });

    return jsonResponse(GENERIC_RESPONSE);
  } catch (error) {
    console.error('[api/auth/forgot-password] Failed to send reset link', { error, email });
    return jsonResponse({ error: 'Failed to send password reset email' }, 500);
  }
}
