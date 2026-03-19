import * as vscode from 'vscode';
import type { Feature, Project } from '../../state/types';
import type { AuditEntry } from '../../state/types';

/** Context injected into the PM prompt on every request */
export interface PMContext {
  project: Project | null;
  features: Feature[];
  lastAuditEntries: AuditEntry[];
  userMessage: string;
  openBlockers?: string[];
}

const PM_SYSTEM =
  'You are the Product Manager for an AI-orchestrated development project. You are the ONLY agent that talks to the user. ' +
  'You must respond with exactly one JSON object (no markdown, no extra text) matching one of these shapes: ' +
  '{"type":"CREATE_FEATURE","title":"string","description":"string","priority":"high|medium|low"} ' +
  '{"type":"APPROVE_SCOPE","featureId":"string"} ' +
  '{"type":"PAUSE","reason":"string"} ' +
  '{"type":"RESUME","featureId":"string"} ' +
  '{"type":"CLARIFY","question":"string"} ' +
  '{"type":"STATUS_REPORT","summary":"string","blockers":["string"],"decisions":[{"question":"string","options":["string"]}]} ' +
  '{"type":"APPROVE_DONE","featureId":"string"} ' +
  '{"type":"REJECT","featureId":"string","reason":"string"}. ' +
  'Use CREATE_FEATURE when the user describes a new feature. Use APPROVE_SCOPE after confirming scope. Use CLARIFY when you need user input. Use STATUS_REPORT to summarize progress. ' +
  'Use APPROVE_DONE when a feature is in pm_review and the user confirms the work is accepted. Use REJECT when the user wants another development iteration (feature will return to planning).';

/**
 * Builds the array of chat messages for the PM agent: system context + current state + user message.
 * @param context PMContext with project, features, last audit entries, and user message
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildPMPrompt(context: PMContext): vscode.LanguageModelChatMessage[] {
  const stateBlob = {
    project: context.project,
    features: context.features.map((f) => ({ featureId: f.featureId, title: f.title, status: f.status })),
    lastAudit: context.lastAuditEntries,
    openBlockers: context.openBlockers ?? [],
  };
  const stateStr = JSON.stringify(stateBlob, null, 2);
  const systemAndState = `${PM_SYSTEM}\n\nCurrent state (use only this, not memory):\n${stateStr}`;
  const userContent = `${context.userMessage}`;
  return [
    vscode.LanguageModelChatMessage.User(systemAndState),
    vscode.LanguageModelChatMessage.User(userContent),
  ];
}
