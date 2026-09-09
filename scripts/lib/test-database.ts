import { z } from 'zod';

const origin = 'https://claimable.neon.tech';
const registrationSchema = z.object({
  identity_assertion: z.string().min(1),
  project: z.object({ id: z.string().regex(/^[a-z0-9-]+$/), expires_at: z.string().datetime() }),
  capabilities: z.array(z.object({ capability: z.string(), granted: z.boolean() })),
});
export const disposableDatabaseSchema = z.object({
  purpose: z.literal('disposable-integration-and-preview-only'),
  identityAssertion: z.string().min(1),
  project: registrationSchema.shape.project,
  databaseUrl: z.string().url(),
});
export type DisposableDatabase = z.infer<typeof disposableDatabaseSchema>;
type Identity = Pick<DisposableDatabase, 'identityAssertion' | 'project'>;
type Fetch = typeof fetch;

async function request(fetcher: Fetch, path: string, init?: RequestInit) {
  const response = await fetcher(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Disposable Neon request failed: HTTP ${response.status} (${path})`);
  return response.json() as Promise<unknown>;
}

async function accessToken(identity: Identity, fetcher: Fetch) {
  return z.object({ access_token: z.string().min(1) }).parse(await request(fetcher, '/v1/oauth2/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: identity.identityAssertion, resource: `${origin}/`,
    }),
  })).access_token;
}

export async function deleteDisposableDatabase(identity: Identity, fetcher: Fetch = fetch) {
  const token = await accessToken(identity, fetcher);
  const response = await fetcher(`${origin}/v1/projects/${identity.project.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Disposable Neon cleanup failed: HTTP ${response.status}, project ${identity.project.id}`);
}

async function credentials(identity: Identity, fetcher: Fetch) {
  if (Date.parse(identity.project.expires_at) <= Date.now()) throw new Error('Disposable Neon project has expired');
  const token = await accessToken(identity, fetcher);
  const result = z.object({ project_id: z.string(), database_url: z.string().url() }).parse(
    await request(fetcher, `/v1/projects/${identity.project.id}/credentials`, { headers: { authorization: `Bearer ${token}` } }),
  );
  const url = new URL(result.database_url);
  if (result.project_id !== identity.project.id || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'require') {
    throw new Error('Credentials did not identify the expected TLS-required disposable Neon database');
  }
  return result.database_url;
}

export async function verifyDisposableDatabase(database: DisposableDatabase, fetcher: Fetch = fetch) {
  if (await credentials(database, fetcher) !== database.databaseUrl) {
    throw new Error('The fixture connection does not match its disposable project identity');
  }
}

export async function createDisposableDatabase(fetcher: Fetch = fetch): Promise<DisposableDatabase> {
  const registration = registrationSchema.parse(await request(fetcher, '/v1/agent/identity', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'anonymous', capabilities: ['postgres'], source: 'college-gridiron-integration' }),
  }));
  const identity = { identityAssertion: registration.identity_assertion, project: registration.project };
  try {
    if (!registration.capabilities.some(value => value.capability === 'postgres' && value.granted)) {
      throw new Error('Disposable Neon did not grant Postgres access');
    }
    return { ...identity, purpose: 'disposable-integration-and-preview-only', databaseUrl: await credentials(identity, fetcher) };
  } catch (error) {
    try {
      await deleteDisposableDatabase(identity, fetcher);
    } catch (cleanupError) {
      console.error('Disposable database provisioning also encountered a cleanup failure', cleanupError);
    }
    throw error;
  }
}
