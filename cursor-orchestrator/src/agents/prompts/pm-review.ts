import * as vscode from 'vscode';
import type { Feature, Project, Task, AuditEntry } from '../../state/types';

/** Context for the scheduled PM review: full state snapshot from stores. */
export interface PMReviewContext {
  project: Project | null;
  features: Feature[];
  tasks: Task[];
  auditEntries: AuditEntry[];
}

const PM_REVIEW_SYSTEM =
  'You are the Product Manager for an AI-orchestrated development project. ' +
  'A 60-minute review has triggered. You are given the current project state (features, tasks, recent audit log). ' +
  'Synthesize a brief STATUS_REPORT for the user: one JSON object with type "STATUS_REPORT", ' +
  '"summary" (string, 2-4 sentences of progress and current state), "blockers" (array of strings, empty if none), ' +
  'and "decisions" (array of {question, options} if the user must decide something, else empty). ' +
  'Output only the JSON object, no markdown or extra text.';

/**
 * Builds the array of chat messages for the scheduled PM review: system + full state blob.
 * The PM is asked to produce a STATUS_REPORT from the injected state.
 * @param context PMReviewContext with project, features, tasks, audit entries
 * @returns Array of LanguageModelChatMessage for vscode.lm
 */
export function buildPMReviewPrompt(context: PMReviewContext): vscode.LanguageModelChatMessage[] {
  const stateBlob = {
    project: context.project,
    features: context.features.map((f) => ({
      featureId: f.featureId,
      title: f.title,
      status: f.status,
      taskCount: f.tasks.length,
      updatedAt: f.updatedAt,
    })),
    tasks: context.tasks.map((t) => ({
      taskId: t.taskId,
      featureId: t.featureId,
      title: t.title,
      status: t.status,
    })),
    recentAudit: context.auditEntries,
  };
  const stateStr = JSON.stringify(stateBlob, null, 2);
  const systemAndUser = `${PM_REVIEW_SYSTEM}\n\nCurrent state:\n${stateStr}`;
  return [vscode.LanguageModelChatMessage.User(systemAndUser)];
}
