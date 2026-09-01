/**
 * Shared helpers for the data refresh scripts.
 *
 * These run in GitHub Actions (and locally), not on Vercel — CFBD cold calls
 * can take 30s, which does not fit an edge function's budget.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loads .env.local for local runs. In CI the values come from repo secrets. */
export function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Strip a single matching pair of surrounding quotes, leaving the value
    // itself intact (CFBD keys are base64 and may contain = + /).
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local or the workflow secrets.`);
  }
  return value;
}

export function logStep(message: string, details?: Record<string, unknown>): void {
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`[refresh] ${message}${suffix}`);
}

/** Runs a script body with env loaded and consistent failure handling. */
export async function runScript(name: string, body: () => Promise<void>): Promise<void> {
  loadLocalEnv();
  const startedAt = Date.now();
  logStep(`${name} starting`);
  try {
    await body();
    logStep(`${name} complete`, { durationMs: Date.now() - startedAt });
  } catch (error) {
    console.error(`[refresh] ${name} FAILED`, error);
    process.exitCode = 1;
  }
}
