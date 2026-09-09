import { neonConfig } from '@neondatabase/serverless';

const connection = 'postgresql://fixture:local-fixture-only@db:5432/gridiron_test?sslmode=disable';
if (process.env.DATABASE_URL || process.env.VERCEL_ENV) {
  throw new Error('Local fixtures must run without application database credentials or a Vercel environment.');
}
if (process.env.DATABASE_URL_TEST && process.env.DATABASE_URL_TEST !== connection) {
  throw new Error('Local fixtures must not override an existing DATABASE_URL_TEST.');
}
const proxy = new URL(process.env.DATABASE_TEST_PROXY_URL ?? 'http://127.0.0.1:55433');
if (proxy.protocol !== 'http:' || proxy.hostname !== '127.0.0.1' || !proxy.port ||
    proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash) {
  throw new Error('DATABASE_TEST_PROXY_URL must be a plain HTTP loopback origin with an explicit port.');
}

// This opt-in test preload never changes the production driver configuration.
process.env.DATABASE_URL_TEST = connection;
neonConfig.wsProxy = `${proxy.host}/v1`;
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineConnect = false;
