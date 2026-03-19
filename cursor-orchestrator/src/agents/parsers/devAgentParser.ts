import { z } from 'zod';
import { parseAgentOutput } from './outputParser';

const confidenceSchema = z.enum(['high', 'medium', 'low']);
const taskDoneSchema = z.object({
  type: z.literal('TASK_DONE'),
  filesChanged: z.array(z.string()),
  implementationNotes: z.string(),
  confidence: confidenceSchema,
  assumptions: z.array(z.string()),
});
const blockedSchema = z.object({
  type: z.literal('BLOCKED'),
  reason: z.string(),
  blockers: z.array(z.string()),
});

/** Zod schema for Dev Agent command output (discriminated union) */
export const DevAgentCommandSchema = z.discriminatedUnion('type', [
  taskDoneSchema,
  blockedSchema,
]);

export type DevAgentCommandParsed = z.infer<typeof DevAgentCommandSchema>;

/**
 * Parses raw Dev Agent output into a typed DevAgentCommand.
 * @param raw Raw string response from the model
 * @returns { ok: true, value } or { ok: false, error }
 */
export function parseDevAgentOutput(raw: string): ReturnType<
  typeof parseAgentOutput<DevAgentCommandParsed>
> {
  return parseAgentOutput(raw, DevAgentCommandSchema);
}
