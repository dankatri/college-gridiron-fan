export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
  if (error instanceof Error && ['Not authenticated', 'Invalid session'].includes(error.message)) {
    return jsonResponse({ error: error.message }, 401);
  }
  const cause = error instanceof Error && 'cause' in error && error.cause ? error.cause : error;
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  if (code === '55P03' || code === '40P01') {
    return jsonResponse({ error: 'Another save is in progress. Please retry.' }, 409);
  }
  console.error('API request failed', { code: typeof code === 'string' ? code : 'unknown' });
  return jsonResponse({ error: 'The request could not be completed. Please retry.' }, 500);
}
