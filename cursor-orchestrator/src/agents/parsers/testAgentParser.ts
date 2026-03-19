import { z } from 'zod';
import { parseAgentOutput } from './outputParser';

const resultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  passed: z.boolean(),
  notes: z.string(),
});
const bugItemSchema = z.object({
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  files: z.array(z.string()),
});
const testResultSchema = z.object({
  type: z.literal('TEST_RESULT'),
  passed: z.boolean(),
  results: z.array(resultItemSchema),
  bugs: z.array(bugItemSchema),
});
const blockedSchema = z.object({
  type: z.literal('BLOCKED'),
  reason: z.string(),
  blockers: z.array(z.string()),
});

/** Zod schema for Test Agent command output (discriminated union) */
export const TestAgentCommandSchema = z.discriminatedUnion('type', [
  testResultSchema,
  blockedSchema,
]);

export type TestAgentCommandParsed = z.infer<typeof TestAgentCommandSchema>;

/**
 * Parses raw Test Agent output into a typed TestAgentCommand.
 * @param raw Raw string response from the model
 * @returns { ok: true, value } or { ok: false, error }
 */
export function parseTestAgentOutput(raw: string): ReturnType<
  typeof parseAgentOutput<TestAgentCommandParsed>
> {
  return parseAgentOutput(raw, TestAgentCommandSchema);
}
