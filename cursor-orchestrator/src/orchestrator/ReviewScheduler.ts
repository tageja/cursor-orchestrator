import * as vscode from 'vscode';
import { ProjectStore } from '../state/ProjectStore';
import { FeatureStore } from '../state/FeatureStore';
import { TaskStore } from '../state/TaskStore';
import { AuditLog } from '../state/AuditLog';
import { buildPMReviewPrompt } from '../agents/prompts/pm-review';
import type { PMReviewContext } from '../agents/prompts/pm-review';
import { runAgent } from '../agents/AgentRunner';

let timer: ReturnType<typeof setInterval> | null = null;
let postFn: ((type: string, payload: object) => void) | null = null;

function getReviewIntervalMs(): number {
  const minutes = vscode.workspace.getConfiguration('orchestrator').get<number>('reviewIntervalMinutes', 60);
  const safe = typeof minutes === 'number' && minutes >= 5 ? minutes : 60;
  return safe * 60 * 1000;
}

function post(type: string, payload: object): void {
  if (postFn) postFn(type, payload);
}

/**
 * Called every 60 minutes: pause project, run PM review prompt, post result to webview.
 * Does not auto-resume; user must trigger RESUME via PM.
 */
async function tick(workspacePath: string): Promise<void> {
  try {
    await ProjectStore.init(workspacePath);
    await FeatureStore.init(workspacePath);
    await TaskStore.init(workspacePath);
    await AuditLog.init(workspacePath);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    post('PM_REVIEW_STARTED', { summary: `Review skipped: ${err}` });
    post('PAUSED', { reason: err });
    return;
  }

  await ProjectStore.setStatus('paused_for_review');

  let project = null;
  let features: Awaited<ReturnType<typeof FeatureStore.read>> = [];
  let tasks: Awaited<ReturnType<typeof TaskStore.read>> = [];
  let auditEntries: Awaited<ReturnType<typeof AuditLog.readLast>> = [];

  try {
    project = await ProjectStore.read();
    features = await FeatureStore.read();
    tasks = await TaskStore.read();
    auditEntries = await AuditLog.readLast(20);
  } catch {
    post('PM_REVIEW_STARTED', { summary: 'Could not load state for review.' });
    post('PAUSED', { reason: 'State load failed' });
    return;
  }

  const context: PMReviewContext = { project, features, tasks, auditEntries };
  const messages = buildPMReviewPrompt(context);

  let summary: string;
  try {
    const result = await runAgent('project-manager', messages);
    if (result.command?.type === 'STATUS_REPORT' && result.command.summary) {
      summary = result.command.summary;
    } else {
      summary = result.raw.trim().slice(0, 500) || 'PM review completed.';
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    summary = `Review run failed: ${err}`;
  }

  post('PM_REVIEW_STARTED', { summary });
  post('PAUSED', { reason: 'Scheduled PM review interval' });
}

/**
 * Start the 60-minute review scheduler. Replaces any existing timer and post callback.
 * @param workspacePath Workspace root path (used to init stores and run tick)
 * @param post Callback to post messages to the webview (type, payload)
 */
export function start(workspacePath: string, post: (type: string, payload: object) => void): void {
  stop();
  postFn = post;
  const intervalMs = getReviewIntervalMs();
  timer = setInterval(() => void tick(workspacePath), intervalMs);
}

/**
 * Stop the scheduler and clear the post callback.
 */
export function stop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  postFn = null;
}

/**
 * Update the post callback (e.g. when webview is reopened). Does not start the timer.
 * @param post New callback for posting to webview
 */
export function updatePostMessage(post: (type: string, payload: object) => void): void {
  postFn = post;
}
