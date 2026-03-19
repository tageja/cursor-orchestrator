import type { Task } from '../state/types';
import { FeatureStore } from '../state/FeatureStore';
import { TaskStore } from '../state/TaskStore';
import { ProjectStore } from '../state/ProjectStore';
import { AuditLog } from '../state/AuditLog';
import { transition } from './StateMachine';
import { runProductLeadAgent } from '../agents/AgentRunner';
import { parseProductLeadOutput } from '../agents/parsers/productLeadParser';
import type { PMCommandParsed } from '../agents/parsers/outputParser';
import { startDevCycle } from './DevCycleRunner';
import type { PostMessageToWebview } from './DevCycleRunner';
import { start as schedulerStart, stop as schedulerStop } from './ReviewScheduler';

export interface RouterResult {
  action:
    | 'product_lead_invoked'
    | 'dev_cycle_started'
    | 'paused'
    | 'resumed'
    | 'feature_approved'
    | 'feature_rejected'
    | 'noop'
    | 'error';
  featureId?: string;
  taskCount?: number;
  message?: string;
}

/**
 * Handles a PM command from the orchestrator. Routes APPROVE_SCOPE to Product Lead and TaskStore,
 * then starts the dev cycle (Dev Lead + Dev Agent) in the background if postMessage is provided.
 * @param command Parsed PM command
 * @param workspacePath Workspace path (caller must have already inited stores)
 * @param postMessage Optional callback to post dev cycle events to the webview
 * @returns RouterResult describing what action was taken
 */
export async function handlePMCommand(
  command: PMCommandParsed,
  workspacePath: string,
  postMessage?: PostMessageToWebview
): Promise<RouterResult> {
  const post = postMessage ?? (() => {});

  if (command.type === 'PAUSE') {
    await ProjectStore.setStatus('paused_for_review');
    schedulerStop();
    post('PAUSED', { reason: command.reason });
    return { action: 'paused' };
  }

  if (command.type === 'RESUME') {
    await ProjectStore.setStatus('active');
    schedulerStart(workspacePath, post);
    post('RESUMED', { featureId: command.featureId });
    return { action: 'resumed', featureId: command.featureId };
  }

  if (command.type === 'APPROVE_DONE') {
    const feat = await FeatureStore.getById(command.featureId);
    if (!feat) {
      return { action: 'error', message: `Feature not found: ${command.featureId}` };
    }
    if (feat.status !== 'pm_review') {
      return {
        action: 'error',
        message: `Feature ${command.featureId} is not in pm_review (current: ${feat.status})`,
      };
    }
    await transition(feat, 'approved_done', 'project-manager');
    await FeatureStore.update(command.featureId, {
      pmSignoff: new Date().toISOString(),
    });
    post('FEATURE_APPROVED', { featureId: command.featureId });
    return { action: 'feature_approved', featureId: command.featureId };
  }

  if (command.type === 'REJECT') {
    const featReject = await FeatureStore.getById(command.featureId);
    if (!featReject) {
      return { action: 'error', message: `Feature not found: ${command.featureId}` };
    }
    if (featReject.status !== 'pm_review') {
      return {
        action: 'error',
        message: `Feature ${command.featureId} is not in pm_review (current: ${featReject.status})`,
      };
    }
    await transition(featReject, 'rejected', 'project-manager');
    const afterReject = await FeatureStore.getById(command.featureId);
    if (afterReject) {
      await transition(afterReject, 'dev_planned', 'project-manager');
    }
    post('FEATURE_REJECTED', { featureId: command.featureId, reason: command.reason });
    return { action: 'feature_rejected', featureId: command.featureId, message: command.reason };
  }

  if (command.type !== 'APPROVE_SCOPE') {
    return { action: 'noop', message: `Unhandled command type: ${(command as { type: string }).type}` };
  }

  const feature = await FeatureStore.getById(command.featureId);
  if (!feature) {
    return { action: 'error', message: `Feature not found: ${command.featureId}` };
  }
  if (feature.status !== 'draft_scope') {
    return { action: 'error', message: `Feature ${command.featureId} is not in draft_scope (current: ${feature.status})` };
  }

  await transition(feature, 'approved_scope', 'project-manager');
  const featureAfterApprove = await FeatureStore.getById(command.featureId);
  if (!featureAfterApprove) {
    return { action: 'error', message: 'Feature missing after transition' };
  }

  const existingTasks = await TaskStore.getByFeatureId(command.featureId);
  let project = null;
  try {
    project = await ProjectStore.read();
  } catch {
    // optional
  }
  const context = {
    feature: featureAfterApprove,
    existingTasks,
    project,
  };

  const result = await runProductLeadAgent(context);
  let parsed = result.command;
  if (!parsed) {
    const pr = parseProductLeadOutput(result.raw);
    parsed = pr.ok ? pr.value : null;
  }

  if (!parsed) {
    await AuditLog.append({
      timestamp: new Date().toISOString(),
      role: 'orchestrator',
      action: 'product_lead_parse_error',
      payload: { featureId: command.featureId, parseError: result.parseError },
      featureId: command.featureId,
      taskId: null,
    });
    return { action: 'error', message: result.parseError ?? 'Failed to parse Product Lead output' };
  }

  if (parsed.type === 'CLARIFY' || parsed.type === 'BLOCKED') {
    const msg = parsed.type === 'CLARIFY' ? parsed.question : parsed.reason;
    return { action: 'noop', message: msg };
  }

  if (parsed.type !== 'PLAN_TASKS') {
    return { action: 'noop', message: 'Product Lead did not return PLAN_TASKS' };
  }

  const now = new Date().toISOString();
  const taskIds: string[] = [];
  const baseId = Date.now();
  for (let index = 0; index < parsed.tasks.length; index++) {
    const t = parsed.tasks[index];
    const taskId = `TASK-${baseId}-${index}`;
    taskIds.push(taskId);
    const task: Task = {
      taskId,
      featureId: featureAfterApprove.featureId,
      title: t.title,
      description: t.description,
      ownerAgent: 'dev-agent',
      status: 'todo',
      allowedFiles: t.allowedFiles,
      implementationNotes: null,
      filesChanged: [],
      blockers: [],
      confidence: null,
      assumptions: [],
      evidenceFiles: [],
      dependsOn: t.dependsOn,
      handoffTo: 'dev-lead',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    await TaskStore.add(task);
  }

  await transition(featureAfterApprove, 'dev_planned', 'product-lead');
  await FeatureStore.update(command.featureId, { tasks: taskIds });

  // Start dev cycle in background (Dev Lead assigns tasks, Dev Agent implements; one at a time via LockManager)
  startDevCycle(command.featureId, workspacePath, postMessage).catch(() => {
    // Errors are logged and surfaced via postMessage; avoid unhandled rejection
  });

  return {
    action: 'product_lead_invoked',
    featureId: command.featureId,
    taskCount: taskIds.length,
  };
}
