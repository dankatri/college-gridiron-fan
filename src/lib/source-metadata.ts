import { z } from 'zod';

export const sourceMetadataFields = z.object({
  sourceCheckedAt: z.string().nullable().optional(),
  sourceAttemptedAt: z.string().nullable().optional(),
  contentVersion: z.string().nullable().optional(),
  sourceStatus: z.enum(['ready', 'refreshing', 'failed', 'incomplete']).optional(),
});

export function resourceSource(payload: z.infer<typeof sourceMetadataFields> & { updatedAt?: string | null }) {
  const sourceStatus = payload.sourceStatus ?? 'ready';
  return {
    sourceCheckedAt: payload.sourceCheckedAt ?? payload.updatedAt ?? null,
    sourceAttemptedAt: payload.sourceAttemptedAt ?? null,
    contentVersion: payload.contentVersion ?? null,
    sourceStatus,
    sourceError: sourceStatus === 'failed' || sourceStatus === 'incomplete'
      ? new Error('The source refresh is incomplete or failed. Showing the last accepted data.')
      : null,
  };
}
