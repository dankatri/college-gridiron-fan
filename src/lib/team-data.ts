import { z } from 'zod';
import { createResource } from './async-resource';

const teamSchema = z.object({
  school: z.string(),
  logo: z.string().nullable().optional(),
});
const payloadSchema = z.object({
  teams: z.array(teamSchema).nonempty('Team logos are not available yet.'),
  updatedAt: z.string().nullable(),
});

export const teamsResource = createResource<Array<z.infer<typeof teamSchema>>>(async signal => {
  const response = await fetch('/api/teams', { signal });
  if (!response.ok) throw new Error(`/api/teams failed: ${response.status}`);
  const payload = payloadSchema.parse(await response.json());
  return { data: payload.teams, sourceCheckedAt: payload.updatedAt };
}, { ttlMs: 60 * 60 * 1000 });
