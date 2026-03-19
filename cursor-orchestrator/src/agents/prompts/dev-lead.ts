import * as vscode from 'vscode';
import type { Feature, Task, Project } from '../../state/types';

/** Context injected into the Dev Lead prompt — pending tasks are those with status todo */
export interface DevLeadContext {
  feature: Feature;
  pendingTasks: Task[];
  project: Project | null;
}

const DL_SYSTEM =
  'You are the Dev Lead for an AI-orchestrated development project. You assign exactly one task at a time to the Dev Agent. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"ASSIGN_TASK","taskId":"string"} ' +
  '{"type":"BLOCKED","reason":"string"}. ' +
  'Use ASSIGN_TASK with the taskId of the task you are assigning. Pick exactly one task from the pending list. ' +
  'Respect dependsOn: only assign a task whose dependsOn tasks are already done (or empty). If no task is eligible, use BLOCKED. ' +
  'Do not write code. Do not implement. Only assign one task.';

/**
 * Builds the array of chat messages for the Dev Lead agent.
 * @param context DevLeadContext with feature, pending (todo) tasks, and project
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildDevLeadPrompt(
  context: DevLeadContext
): vscode.LanguageModelChatMessage[] {
  const payload = {
    feature: {
      featureId: context.feature.featureId,
      title: context.feature.title,
      description: context.feature.description,
      status: context.feature.status,
    },
    pendingTasks: context.pendingTasks.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      description: t.description,
      dependsOn: t.dependsOn,
    })),
    projectName: context.project?.name ?? null,
  };
  const userContent = JSON.stringify(payload, null, 2);
  const systemAndUser = `${DL_SYSTEM}\n\nCurrent context (use only this):\n${userContent}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
