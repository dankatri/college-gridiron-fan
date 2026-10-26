/**
 * Vite plugin that serves the local FCS preview API.
 *
 * Active only when `DEV_PREVIEW=1` (set by `npm run dev:preview`), and only in
 * the dev server — it adds nothing to a production build.
 */

import type { Plugin } from 'vite';

import { createDevApi, loadSnapshot } from './lib/dev-api';
import { CLASSIFICATION_LABELS } from '../src/lib/classification';

export function devPreviewApi(): Plugin {
  return {
    name: 'fcs-dev-preview-api',
    apply: 'serve',
    async configureServer(server) {
      const snapshot = await loadSnapshot();
      const counts = snapshot.divisions.map((division) => {
        const players = snapshot.players.filter((player) => player.classification === division).length;
        return `${CLASSIFICATION_LABELS[division]}: ${players}`;
      });

      server.middlewares.use(createDevApi(snapshot));

      server.config.logger.info(
        `\n  FCS preview  ${snapshot.players.length} players (${counts.join(', ')}) ` +
        `across ${snapshot.teams.length} teams\n` +
        `  season stats shown are real ${snapshot.projectionYear} totals; ` +
        `accounts and lineups are in-memory only\n`,
      );
    },
  };
}
