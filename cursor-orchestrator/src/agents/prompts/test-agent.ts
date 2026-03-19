import * as vscode from 'vscode';
import type { Feature } from '../../state/types';

/** A single test case from the Test Manager (id, title, steps, expectedResult) */
export interface TestCaseInput {
  id: string;
  title: string;
  steps: string[];
  expectedResult: string;
}

/** Context injected into the Test Agent prompt — feature and test cases to execute */
export interface TestAgentContext {
  feature: Feature;
  testCases: TestCaseInput[];
  filesChanged: string[];
}

const TA_SYSTEM =
  'You are a Test Agent in an AI-orchestrated development project. You execute test cases and report pass/fail. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"TEST_RESULT","passed":boolean,"results":[{"id":"string","title":"string","passed":boolean,"notes":"string"}],"bugs":[{"description":"string","severity":"high|medium|low","files":["string"]}]} ' +
  '{"type":"BLOCKED","reason":"string","blockers":["string"]}. ' +
  'Use TEST_RESULT after evaluating each test case: passed is true only if every test passed; results must have one entry per test case with id, title, passed, notes; bugs lists any defects found (description, severity, affected files). ' +
  'Use BLOCKED if you cannot run tests (e.g. environment missing). Do not write prose; output only the JSON object.';

/**
 * Builds the array of chat messages for the Test Agent.
 * @param context TestAgentContext with feature, test cases, and filesChanged
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildTestAgentPrompt(
  context: TestAgentContext
): vscode.LanguageModelChatMessage[] {
  const payload = {
    feature: {
      featureId: context.feature.featureId,
      title: context.feature.title,
      description: context.feature.description,
    },
    testCases: context.testCases,
    filesChanged: context.filesChanged,
  };
  const userContent = JSON.stringify(payload, null, 2);
  const systemAndUser = `${TA_SYSTEM}\n\nCurrent context (use only this):\n${userContent}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
