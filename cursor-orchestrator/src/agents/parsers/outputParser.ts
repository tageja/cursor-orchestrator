import { z } from 'zod';

const prioritySchema = z.enum(['high', 'medium', 'low']);
const createFeatureSchema = z.object({
  type: z.literal('CREATE_FEATURE'),
  title: z.string(),
  description: z.string(),
  priority: prioritySchema,
});
const approveScopeSchema = z.object({
  type: z.literal('APPROVE_SCOPE'),
  featureId: z.string(),
});
const pauseSchema = z.object({
  type: z.literal('PAUSE'),
  reason: z.string(),
});
const resumeSchema = z.object({
  type: z.literal('RESUME'),
  featureId: z.string(),
});
const clarifySchema = z.object({
  type: z.literal('CLARIFY'),
  question: z.string(),
});
const statusReportSchema = z.object({
  type: z.literal('STATUS_REPORT'),
  summary: z.string(),
  blockers: z.array(z.string()),
  decisions: z.array(z.object({ question: z.string(), options: z.array(z.string()) })),
});
const approveDoneSchema = z.object({
  type: z.literal('APPROVE_DONE'),
  featureId: z.string(),
});
const rejectSchema = z.object({
  type: z.literal('REJECT'),
  featureId: z.string(),
  reason: z.string(),
});

/** Zod schema for PM command output (discriminated union) */
export const PMCommandSchema = z.discriminatedUnion('type', [
  createFeatureSchema,
  approveScopeSchema,
  pauseSchema,
  resumeSchema,
  clarifySchema,
  statusReportSchema,
  approveDoneSchema,
  rejectSchema,
]);

export type PMCommandParsed = z.infer<typeof PMCommandSchema>;

export interface ParseError {
  message: string;
  raw?: string;
}

/**
 * Extracts JSON from raw model output (handles markdown code blocks) and validates with schema.
 * @param raw Raw string response from the model
 * @param schema Zod schema to validate against
 * @returns { ok: true, value } or { ok: false, error: ParseError }
 */
export function parseAgentOutput<T>(
  raw: string,
  schema: z.ZodType<T>
): { ok: true; value: T } | { ok: false; error: ParseError } {
  let jsonStr = raw.trim();
  const codeBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
  if (codeBlock) {
    jsonStr = codeBlock[1].trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'JSON parse failed';
    return { ok: false, error: { message, raw } };
  }
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const message = result.error.errors.map((e) => e.message).join('; ');
  return { ok: false, error: { message, raw } };
}
