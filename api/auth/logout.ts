import { clearSessionCookieHeader } from '../_lib/auth-utils';

export const config = {
  runtime: 'nodejs',
};

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  return jsonResponse({ ok: true }, 200, clearSessionCookieHeader());
}
