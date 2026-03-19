import * as vscode from 'vscode';
import type { Feature, Task, Project } from '../../state/types';

/** Context injected into the Test Manager prompt — feature and completed dev tasks with implementation details */
export interface TestManagerContext {
  feature: Feature;
  tasks: Task[];
  project: Project | null;
}

const TM_SYSTEM =
  'You are the Test Manager for an AI-orchestrated development project. You write test cases for a feature that has been implemented. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"WRITE_TEST_CASES","testCases":[{"id":"string","title":"string","steps":["string"],"expectedResult":"string"}]} ' +
  '{"type":"BLOCKED","reason":"string"}. ' +
  'Use WRITE_TEST_CASES to output an array of test cases. Each test case must have: id (unique, e.g. TC-1), title, steps (array of step descriptions), expectedResult. ' +
  'Base test cases on the feature description and the implementation notes from completed dev tasks. Use BLOCKED if you cannot write meaningful test cases. ' +
  'Do not execute tests. Do not change product scope. Only plan test cases.';

/**
 * Builds the array of chat messages for the Test Manager agent.
 * @param context TestManagerContext with feature, tasks (with implementationNotes, filesChanged), and project
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildTestManagerPrompt(
  context: TestManagerContext
): vscode.LanguageModelChatMessage[] {
  const payload = {
    feature: {
      featureId: context.feature.featureId,
      title: context.feature.title,
      description: context.feature.description,
      status: context.feature.status,
    },
    tasks: context.tasks.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      description: t.description,
      implementationNotes: t.implementationNotes,
      filesChanged: t.filesChanged,
    })),
    projectName: context.project?.name ?? null,
  };
  const userContent = JSON.stringify(payload, null, 2);
  const systemAndUser = `${TM_SYSTEM}\n\nCurrent context (use only this):\n${userContent}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
