import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { projectPlayerLog, projectPlayers, projectTeamSchedule, projectWeeklyScores } from '../src/server/cache-projections';

test('JSONB projections parameterize identifiers and preserve array ordering', () => {
  const malicious = "x'); select pg_sleep(99); --";
  const dialect = new PgDialect();
  for (const query of [
    projectPlayerLog(2026, malicious), projectPlayers(2026, [malicious]),
    projectTeamSchedule(2026, malicious), projectWeeklyScores(2026, { 0: [malicious] }),
  ]) {
    const compiled = dialect.sqlToQuery(query);
    assert.equal(compiled.sql.includes(malicious), false);
    assert.ok(compiled.params.some(value => typeof value === 'string' && value.includes(malicious)));
    assert.match(compiled.sql, /ordinality/);
  }
  assert.match(dialect.sqlToQuery(projectPlayerLog(2026, 'player')).sql, /order by s.ordinality limit 1/);
});
