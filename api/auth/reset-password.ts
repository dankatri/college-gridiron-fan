import { eq } from 'drizzle-orm';
import { db } from '../../src/server/db';
import { passwordResetTokens, users } from '../../src/server/schema';
import { hashPassword } from '../../src/server/password';
import { hashResetToken } from '../../src/server/password-reset';
import { createSessionToken, sessionCookieHeader } from '../../src/server/auth-utils';

export const config = {
  runtime: 'edge',
};

type ResetPasswordBody = {
  token?: string;
  password?: string;
};

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

const INVALID_TOKEN = {
  error: 'This password reset link is invalid or has expired. Please request a new one.',
  code: 'INVALID_RESET_TOKEN',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: ResetPasswordBody;
  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const token = body.token?.trim() ?? '';
  const password = body.password ?? '';

  if (!token) {
    return jsonResponse(INVALID_TOKEN, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const tokenHash = await hashResetToken(token);
    const rows = await db
      .select({
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    const resetToken = rows[0];
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
      return jsonResponse(INVALID_TOKEN, 400);
    }

    const passwordHash = await hashPassword(password);
    const updated = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetToken.userId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      });

    const user = updated[0];
    if (!user) {
      return jsonResponse(INVALID_TOKEN, 400);
    }

    // Burn every outstanding token for this user, not just the one redeemed.
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, resetToken.userId));

    const sessionToken = await createSessionToken(user.id);
    return jsonResponse({ user }, 200, sessionCookieHeader(sessionToken));
  } catch (error) {
    console.error('[api/auth/reset-password] Failed to reset password', { error });
    return jsonResponse({ error: 'Failed to reset password' }, 500);
  }
}
