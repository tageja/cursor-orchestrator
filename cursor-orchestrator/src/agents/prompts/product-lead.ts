import * as vscode from 'vscode';
import type { Feature, Task, Project } from '../../state/types';

/** Context injected into the Product Lead prompt */
export interface ProductLeadContext {
  feature: Feature;
  existingTasks: Task[];
  project: Project | null;
}

const PL_SYSTEM =
  'You are the Product Lead for an AI-orchestrated development project. You break approved features into byte-sized implementation tasks. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"PLAN_TASKS","featureId":"string","tasks":[{"title":"string","description":"string","allowedFiles":["path"],"dependsOn":["taskTitleOrId"],"priority":"high|medium|low"}]} ' +
  '{"type":"CLARIFY","question":"string"} ' +
  '{"type":"BLOCKED","reason":"string"}. ' +
  'Use PLAN_TASKS to output the task breakdown. Each task must have: title, description, allowedFiles (specific file paths the dev agent may touch), dependsOn (other task titles if sequential), priority. ' +
  'Use CLARIFY if the feature description is too vague to decompose. Use BLOCKED if you cannot proceed. ' +
  'Do not write any code. Do not mark any task done. Only plan.';

/**
 * Builds the array of chat messages for the Product Lead agent.
 * @param context ProductLeadContext with feature, existing tasks, and project
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildProductLeadPrompt(
  context: ProductLeadContext
): vscode.LanguageModelChatMessage[] {
  const payload = {
    feature: {
      featureId: context.feature.featureId,
      title: context.feature.title,
      description: context.feature.description,
      status: context.feature.status,
      priority: context.feature.priority,
    },
    existingTasks: context.existingTasks.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      status: t.status,
    })),
    projectName: context.project?.name ?? null,
  };
  const userContent = JSON.stringify(payload, null, 2);
  const systemAndUser = `${PL_SYSTEM}\n\nCurrent context (use only this):\n${userContent}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
