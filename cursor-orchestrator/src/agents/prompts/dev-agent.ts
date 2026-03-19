import * as vscode from 'vscode';
import type { Feature, Task } from '../../state/types';

/** Context injected into the Dev Agent prompt — the single task to implement */
export interface DevAgentContext {
  task: Task;
  feature: Feature;
}

const DA_SYSTEM =
  'You are a Dev Agent in an AI-orchestrated development project. You implement exactly one assigned task. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"TASK_DONE","filesChanged":["path"],"implementationNotes":"string","confidence":"high|medium|low","assumptions":["string"]} ' +
  '{"type":"BLOCKED","reason":"string","blockers":["string"]}. ' +
  'You may ONLY edit files listed in allowedFiles. filesChanged must be a subset of allowedFiles. ' +
  'Use TASK_DONE after implementing the task: list every file you actually changed in filesChanged, brief implementationNotes, confidence, and assumptions. ' +
  'Use BLOCKED if you cannot complete the task (e.g. missing info, dependency). Do not write prose; output only the JSON object.';

/**
 * Builds the array of chat messages for the Dev Agent.
 * @param context DevAgentContext with the task and feature
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildDevAgentPrompt(
  context: DevAgentContext
): vscode.LanguageModelChatMessage[] {
  const payload = {
    task: {
      taskId: context.task.taskId,
      title: context.task.title,
      description: context.task.description,
      allowedFiles: context.task.allowedFiles,
      implementationNotes: context.task.implementationNotes,
    },
    feature: {
      featureId: context.feature.featureId,
      title: context.feature.title,
      description: context.feature.description,
    },
  };
  const userContent = JSON.stringify(payload, null, 2);
  const systemAndUser = `${DA_SYSTEM}\n\nCurrent context (use only this):\n${userContent}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
