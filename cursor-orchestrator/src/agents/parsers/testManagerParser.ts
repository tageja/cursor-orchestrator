import { z } from 'zod';
import { parseAgentOutput } from './outputParser';

const testCaseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
  expectedResult: z.string(),
});
const writeTestCasesSchema = z.object({
  type: z.literal('WRITE_TEST_CASES'),
  testCases: z.array(testCaseItemSchema),
});
const blockedSchema = z.object({
  type: z.literal('BLOCKED'),
  reason: z.string(),
});

/** Zod schema for Test Manager command output (discriminated union) */
export const TestManagerCommandSchema = z.discriminatedUnion('type', [
  writeTestCasesSchema,
  blockedSchema,
]);

export type TestManagerCommandParsed = z.infer<typeof TestManagerCommandSchema>;

/**
 * Parses raw Test Manager agent output into a typed TestManagerCommand.
 * @param raw Raw string response from the model
 * @returns { ok: true, value } or { ok: false, error }
 */
export function parseTestManagerOutput(raw: string): ReturnType<
  typeof parseAgentOutput<TestManagerCommandParsed>
> {
  return parseAgentOutput(raw, TestManagerCommandSchema);
}
