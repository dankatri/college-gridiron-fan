import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export type LineupTransaction = Parameters<Parameters<NeonDatabase['transaction']>[0]>[0];

/** A single checked-out WebSocket connection, never shared across Edge requests. */
export async function withLineupTransaction<T>(
  action: (transaction: LineupTransaction) => Promise<T>,
  connectionString = process.env.DATABASE_URL,
): Promise<T> {
  if (!connectionString) throw new Error('Database connection is not configured');
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  try {
    const client = await pool.connect();
    try {
      return await drizzle(client).transaction(async transaction => {
        await transaction.execute(sql`set local lock_timeout = '5s'`);
        await transaction.execute(sql`set local statement_timeout = '10s'`);
        await transaction.execute(sql`set local idle_in_transaction_session_timeout = '15s'`);
        return action(transaction);
      });
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
