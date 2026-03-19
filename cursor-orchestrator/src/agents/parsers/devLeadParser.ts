import { z } from 'zod';
import { parseAgentOutput } from './outputParser';

const assignTaskSchema = z.object({
  type: z.literal('ASSIGN_TASK'),
  taskId: z.string(),
});
const blockedSchema = z.object({
  type: z.literal('BLOCKED'),
  reason: z.string(),
});

/** Zod schema for Dev Lead command output (discriminated union) */
export const DevLeadCommandSchema = z.discriminatedUnion('type', [
  assignTaskSchema,
  blockedSchema,
]);

export type DevLeadCommandParsed = z.infer<typeof DevLeadCommandSchema>;

/**
 * Parses raw Dev Lead agent output into a typed DevLeadCommand.
 * @param raw Raw string response from the model
 * @returns { ok: true, value } or { ok: false, error }
 */
export function parseDevLeadOutput(raw: string): ReturnType<
  typeof parseAgentOutput<DevLeadCommandParsed>
> {
  return parseAgentOutput(raw, DevLeadCommandSchema);
}
