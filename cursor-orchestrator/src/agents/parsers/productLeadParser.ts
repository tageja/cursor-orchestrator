import { z } from 'zod';
import { parseAgentOutput } from './outputParser';

const prioritySchema = z.enum(['high', 'medium', 'low']);
const planTaskItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  allowedFiles: z.array(z.string()),
  dependsOn: z.array(z.string()),
  priority: prioritySchema,
});
const planTasksSchema = z.object({
  type: z.literal('PLAN_TASKS'),
  featureId: z.string(),
  tasks: z.array(planTaskItemSchema),
});
const clarifySchema = z.object({
  type: z.literal('CLARIFY'),
  question: z.string(),
});
const blockedSchema = z.object({
  type: z.literal('BLOCKED'),
  reason: z.string(),
});

/** Zod schema for Product Lead command output (discriminated union) */
export const ProductLeadCommandSchema = z.discriminatedUnion('type', [
  planTasksSchema,
  clarifySchema,
  blockedSchema,
]);

export type ProductLeadCommandParsed = z.infer<typeof ProductLeadCommandSchema>;

/**
 * Parses raw Product Lead agent output into a typed ProductLeadCommand.
 * @param raw Raw string response from the model
 * @returns { ok: true, value } or { ok: false, error }
 */
export function parseProductLeadOutput(raw: string): ReturnType<
  typeof parseAgentOutput<ProductLeadCommandParsed>
> {
  return parseAgentOutput(raw, ProductLeadCommandSchema);
}
