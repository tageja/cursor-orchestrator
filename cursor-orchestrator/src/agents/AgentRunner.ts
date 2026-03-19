import * as vscode from 'vscode';
import type { AgentRole } from '../state/types';
import { callAnthropic } from '../util/anthropicClient';
import { AuditLog } from '../state/AuditLog';
import { parseAgentOutput, PMCommandSchema, type PMCommandParsed } from './parsers/outputParser';
import { ProductLeadCommandSchema, type ProductLeadCommandParsed } from './parsers/productLeadParser';
import { DevLeadCommandSchema, type DevLeadCommandParsed } from './parsers/devLeadParser';
import { DevAgentCommandSchema, type DevAgentCommandParsed } from './parsers/devAgentParser';
import { TestManagerCommandSchema, type TestManagerCommandParsed } from './parsers/testManagerParser';
import { TestAgentCommandSchema, type TestAgentCommandParsed } from './parsers/testAgentParser';
import type { z } from 'zod';
import { buildProductLeadPrompt } from './prompts/product-lead';
import type { ProductLeadContext } from './prompts/product-lead';
import { buildDevLeadPrompt } from './prompts/dev-lead';
import type { DevLeadContext } from './prompts/dev-lead';
import { buildDevAgentPrompt } from './prompts/dev-agent';
import type { DevAgentContext } from './prompts/dev-agent';
import { buildTestManagerPrompt } from './prompts/test-manager';
import type { TestManagerContext } from './prompts/test-manager';
import { buildTestAgentPrompt } from './prompts/test-agent';
import type { TestAgentContext } from './prompts/test-agent';

export interface AgentResult {
  raw: string;
  command: PMCommandParsed | null;
  parseError: string | null;
}

export interface ProductLeadAgentResult {
  raw: string;
  command: ProductLeadCommandParsed | null;
  parseError: string | null;
}

export interface DevLeadAgentResult {
  raw: string;
  command: DevLeadCommandParsed | null;
  parseError: string | null;
}

export interface DevAgentAgentResult {
  raw: string;
  command: DevAgentCommandParsed | null;
  parseError: string | null;
}

export interface TestManagerAgentResult {
  raw: string;
  command: TestManagerCommandParsed | null;
  parseError: string | null;
}

export interface TestAgentAgentResult {
  raw: string;
  command: TestAgentCommandParsed | null;
  parseError: string | null;
}

async function streamModelResponse(messages: vscode.LanguageModelChatMessage[]): Promise<string> {
  // Try vscode.lm first (works in VS Code with GitHub Copilot or future Cursor support).
  const lm = (vscode as unknown as { lm?: { selectChatModels: (sel?: unknown) => Promise<vscode.LanguageModelChat[]> } }).lm;
  if (lm?.selectChatModels) {
    try {
      const models = await lm.selectChatModels();
      if (models.length > 0) {
        const model = models[0];
        const response = await model.sendRequest(messages, {});
        let raw = '';
        for await (const chunk of response.stream) {
          if (chunk instanceof vscode.LanguageModelTextPart) {
            raw += chunk.value;
          }
        }
        return raw;
      }
    } catch {
      // vscode.lm failed; fall through to Anthropic API.
    }
  }
  // Fallback: call Anthropic API directly using orchestrator.anthropicApiKey from settings.
  return callAnthropic(messages);
}

/**
 * Internal: runs the language model with the given messages and schema, logs to AuditLog.
 * On parse failure, retries once with a correction user message (both attempts logged).
 * @param role Agent role for logging
 * @param messages Chat messages
 * @param schema Zod schema for parsing the response
 * @param featureId Optional feature id for audit log
 * @param taskId Optional task id for audit log
 * @returns Raw response, parsed value or null, and parse error message if any
 */
async function runWithSchema<T>(
  role: AgentRole,
  messages: vscode.LanguageModelChatMessage[],
  schema: z.ZodType<T>,
  featureId: string | null,
  taskId: string | null = null
): Promise<{ raw: string; command: T | null; parseError: string | null }> {
  const raw1 = await streamModelResponse(messages);
  const parsed1 = parseAgentOutput(raw1, schema);
  const command1 = parsed1.ok ? parsed1.value : null;
  const err1 = parsed1.ok ? null : parsed1.error.message;
  await AuditLog.append({
    timestamp: new Date().toISOString(),
    role,
    action: 'agent_response',
    payload: {
      attempt: 1,
      rawLength: raw1.length,
      commandType: (command1 as { type?: string })?.type ?? null,
      parseError: err1,
    },
    featureId,
    taskId,
  });

  if (command1 !== null) {
    return { raw: raw1, command: command1, parseError: null };
  }

  const correction = vscode.LanguageModelChatMessage.User(
    `Your previous output failed JSON validation: ${err1 ?? 'unknown'}. Raw output was:\n${raw1}\n\nRespond with exactly one valid JSON object matching the required schema. No markdown, no extra text.`
  );
  const raw2 = await streamModelResponse([...messages, correction]);
  const parsed2 = parseAgentOutput(raw2, schema);
  const command2 = parsed2.ok ? parsed2.value : null;
  const err2 = parsed2.ok ? null : parsed2.error.message;
  await AuditLog.append({
    timestamp: new Date().toISOString(),
    role,
    action: 'agent_response_retry',
    payload: {
      attempt: 2,
      rawLength: raw2.length,
      commandType: (command2 as { type?: string })?.type ?? null,
      parseError: err2,
    },
    featureId,
    taskId,
  });

  if (command2 !== null) {
    return { raw: raw2, command: command2, parseError: null };
  }
  return { raw: raw2, command: null, parseError: err2 };
}

/**
 * Runs the PM agent: selects a chat model, sends the prompt, streams the response, parses JSON, logs to AuditLog.
 * @param role Agent role (used in audit log)
 * @param messages Chat messages (from buildPMPrompt)
 * @returns Promise resolving to AgentResult with raw text, parsed command (or null), and parse error if any
 */
export async function runAgent(
  role: AgentRole,
  messages: vscode.LanguageModelChatMessage[]
): Promise<AgentResult> {
  const result = await runWithSchema(role, messages, PMCommandSchema, null, null);
  return {
    raw: result.raw,
    command: result.command as PMCommandParsed | null,
    parseError: result.parseError,
  };
}

/**
 * Runs the Product Lead agent with the given context; parses response with ProductLeadCommandSchema.
 * @param context ProductLeadContext (feature, existingTasks, project)
 * @returns Promise resolving to raw text, parsed ProductLeadCommand or null, and parse error if any
 */
export async function runProductLeadAgent(
  context: ProductLeadContext
): Promise<ProductLeadAgentResult> {
  const messages = buildProductLeadPrompt(context);
  const result = await runWithSchema(
    'product-lead',
    messages,
    ProductLeadCommandSchema,
    context.feature.featureId,
    null
  );
  return {
    raw: result.raw,
    command: result.command as ProductLeadCommandParsed | null,
    parseError: result.parseError,
  };
}

/**
 * Runs the Dev Lead agent with the given context; parses response with DevLeadCommandSchema.
 * @param context DevLeadContext (feature, pendingTasks, project)
 * @returns Promise resolving to raw text, parsed DevLeadCommand or null, and parse error if any
 */
export async function runDevLeadAgent(
  context: DevLeadContext
): Promise<DevLeadAgentResult> {
  const messages = buildDevLeadPrompt(context);
  const result = await runWithSchema(
    'dev-lead',
    messages,
    DevLeadCommandSchema,
    context.feature.featureId,
    null
  );
  return {
    raw: result.raw,
    command: result.command as DevLeadCommandParsed | null,
    parseError: result.parseError,
  };
}

/**
 * Runs the Dev Agent for one task; parses response with DevAgentCommandSchema.
 * @param context DevAgentContext (task, feature)
 * @returns Promise resolving to raw text, parsed DevAgentCommand or null, and parse error if any
 */
export async function runDevAgentTask(
  context: DevAgentContext
): Promise<DevAgentAgentResult> {
  const messages = buildDevAgentPrompt(context);
  const result = await runWithSchema(
    'dev-agent',
    messages,
    DevAgentCommandSchema,
    context.feature.featureId,
    context.task.taskId
  );
  return {
    raw: result.raw,
    command: result.command as DevAgentCommandParsed | null,
    parseError: result.parseError,
  };
}

/**
 * Runs the Test Manager agent with the given context; parses response with TestManagerCommandSchema.
 * @param context TestManagerContext (feature, tasks, project)
 * @returns Promise resolving to raw text, parsed TestManagerCommand or null, and parse error if any
 */
export async function runTestManagerAgent(
  context: TestManagerContext
): Promise<TestManagerAgentResult> {
  const messages = buildTestManagerPrompt(context);
  const result = await runWithSchema(
    'test-manager',
    messages,
    TestManagerCommandSchema,
    context.feature.featureId,
    null
  );
  return {
    raw: result.raw,
    command: result.command as TestManagerCommandParsed | null,
    parseError: result.parseError,
  };
}

/**
 * Runs the Test Agent with the given context; parses response with TestAgentCommandSchema.
 * @param context TestAgentContext (feature, testCases, filesChanged)
 * @returns Promise resolving to raw text, parsed TestAgentCommand or null, and parse error if any
 */
export async function runTestAgentTask(
  context: TestAgentContext
): Promise<TestAgentAgentResult> {
  const messages = buildTestAgentPrompt(context);
  const result = await runWithSchema(
    'test-agent',
    messages,
    TestAgentCommandSchema,
    context.feature.featureId,
    null
  );
  return {
    raw: result.raw,
    command: result.command as TestAgentCommandParsed | null,
    parseError: result.parseError,
  };
}
