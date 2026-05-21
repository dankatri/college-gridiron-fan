import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const dataCache = pgTable('data_cache', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
