import { z } from 'zod';
import { FIRST_WEEK, LAST_WEEK } from '../lib/types';
import { normalizeSlots, validateLineupSlots } from './lineup-utils';

export const weekSchema = z.number().int().min(FIRST_WEEK).max(LAST_WEEK);
export const lineupSlotsSchema = z.array(z.object({
  slotIndex: z.number().int().min(0).max(5),
  position: z.enum(['QB', 'RB', 'WR']),
  playerId: z.string().nullable().optional().transform(value => value || null),
})).transform(normalizeSlots).superRefine((slots, context) => {
  const validation = validateLineupSlots(slots);
  if (!validation.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: validation.error });
});

export const saveLineupSchema = z.object({
  week: weekSchema,
  slots: lineupSlotsSchema,
  projectedPoints: z.number().finite().optional(),
});

export const adminSaveLineupSchema = saveLineupSchema.extend({
  userId: z.string().uuid(),
  reason: z.string().trim().transform(value => value.slice(0, 500)).optional(),
});
