import { spawn } from 'node:child_process';
import { createDisposableDatabase, deleteDisposableDatabase, type DisposableDatabase } from './lib/test-database';
import { isolatedDatabaseURL } from '../tests/integration/fixture';

let disposable: DisposableDatabase | undefined;
try {
  let connection: string;
  if (process.env.DATABASE_URL_TEST) {
    connection = isolatedDatabaseURL();
    console.log('Hosted integration gate: using the explicitly configured isolated database.');
  } else {
    console.log('Hosted integration gate: provisioning a disposable Neon project; production is never a fallback.');
    disposable = await createDisposableDatabase();
    connection = disposable.databaseUrl;
  }
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${connection}`);
  const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL_TEST: connection };
  for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'CFBD_API_KEY', 'RESEND_API_KEY', 'VERCEL_TOKEN', 'VERCEL_OIDC_TOKEN']) {
    delete environment[key];
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', 'test:integration'], { env: environment, stdio: 'inherit' });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    child.once('error', reject);
    child.once('close', code => {
      process.removeListener('SIGTERM', stop);
      process.removeListener('SIGINT', stop);
      if (code === 0) resolve();
      else reject(new Error(`Hosted integration gate failed with exit code ${code}`));
    });
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (disposable) {
    try {
      await deleteDisposableDatabase(disposable);
      console.log('Hosted integration gate: disposable project deleted.');
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
}
