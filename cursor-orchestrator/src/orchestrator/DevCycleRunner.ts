import { FeatureStore } from '../state/FeatureStore';
import { TaskStore } from '../state/TaskStore';
import { ProjectStore } from '../state/ProjectStore';
import { AuditLog } from '../state/AuditLog';
import { transition } from './StateMachine';
import { runDevLeadAgent, runDevAgentTask } from '../agents/AgentRunner';
import { parseDevLeadOutput } from '../agents/parsers/devLeadParser';
import { parseDevAgentOutput } from '../agents/parsers/devAgentParser';
import { acquireLock, releaseLock, isLocked } from './LockManager';
import { startTestCycle } from './TestCycleRunner';
import { checkEvidence } from './EvidenceChecker';
import { checkCompletedTasksConfidence } from './ConfidenceFilter';

/** Callback to post a message to the webview (type and payload only; host adds envelope). */
export type PostMessageToWebview = (type: string, payload: object) => void;

export interface StartDevCycleResult {
  ok: boolean;
  featureId: string;
  taskCount?: number;
  message?: string;
}

/**
 * Runs the dev cycle for a feature: dev_queue -> Dev Lead assigns task -> Dev Agent implements -> repeat until no todos.
 * Uses LockManager so only one dev task is active per feature at a time.
 * @param featureId Feature to run dev cycle for (must be in dev_planned)
 * @param _workspacePath Workspace path (stores must already be inited)
 * @param postMessage Optional callback to notify webview (DEV_TASK_STARTED, DEV_TASK_COMPLETE, DEV_CYCLE_COMPLETE)
 * @returns Result with ok, featureId, taskCount when cycle completes or message on error/blocked
 */
export async function startDevCycle(
  featureId: string,
  _workspacePath: string,
  postMessage?: PostMessageToWebview
): Promise<StartDevCycleResult> {
  const post = (type: string, payload: object) => {
    if (postMessage) postMessage(type, payload);
  };

  const feature = await FeatureStore.getById(featureId);
  if (!feature) {
    return { ok: false, featureId, message: `Feature not found: ${featureId}` };
  }
  if (feature.status !== 'dev_planned') {
    return { ok: false, featureId, message: `Feature ${featureId} is not in dev_planned (current: ${feature.status})` };
  }

  await transition(feature, 'dev_queue', 'orchestrator');
  let currentFeature = await FeatureStore.getById(featureId);
  if (!currentFeature) {
    return { ok: false, featureId, message: 'Feature missing after transition' };
  }

  let completedTaskCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const allTasks = await TaskStore.getByFeatureId(featureId);
    const pendingTasks = allTasks.filter((t) => t.status === 'todo');

    if (pendingTasks.length === 0) {
      if (currentFeature.status === 'dev_task_complete') {
        const allTasksForConf = await TaskStore.getByFeatureId(featureId);
        const confResult = checkCompletedTasksConfidence(allTasksForConf);
        if (!confResult.pass) {
          post('CONFIDENCE_WARNING', {
            featureId,
            lowConfidenceTasks: confResult.lowConfidenceTaskIds,
          });
          return { ok: false, featureId, message: confResult.reason };
        }
        await transition(currentFeature, 'dev_integrated', 'orchestrator');
        post('DEV_CYCLE_COMPLETE', { featureId, taskCount: completedTaskCount });
        startTestCycle(featureId, _workspacePath, postMessage).catch(() => {});
        return { ok: true, featureId, taskCount: completedTaskCount };
      }
      post('DEV_CYCLE_COMPLETE', { featureId, taskCount: completedTaskCount });
      return { ok: true, featureId, taskCount: completedTaskCount };
    }

    if (isLocked(featureId)) {
      return { ok: false, featureId, message: 'Feature is locked; another dev task is active' };
    }

    let project = null;
    try {
      project = await ProjectStore.read();
    } catch {
      // optional
    }
    const devLeadContext = {
      feature: currentFeature,
      pendingTasks,
      project,
    };
    const devLeadResult = await runDevLeadAgent(devLeadContext);
    let devLeadParsed = devLeadResult.command;
    if (!devLeadParsed) {
      const pr = parseDevLeadOutput(devLeadResult.raw);
      devLeadParsed = pr.ok ? pr.value : null;
    }

    if (!devLeadParsed) {
      await AuditLog.append({
        timestamp: new Date().toISOString(),
        role: 'orchestrator',
        action: 'dev_lead_parse_error',
        payload: { featureId, parseError: devLeadResult.parseError },
        featureId,
        taskId: null,
      });
      return { ok: false, featureId, message: devLeadResult.parseError ?? 'Failed to parse Dev Lead output' };
    }

    if (devLeadParsed.type === 'BLOCKED') {
      post('DEV_CYCLE_COMPLETE', { featureId, taskCount: completedTaskCount });
      return { ok: false, featureId, message: `Dev Lead blocked: ${devLeadParsed.reason}` };
    }

    const taskId = devLeadParsed.taskId;
    const task = await TaskStore.getById(taskId);
    if (!task || task.featureId !== featureId) {
      return { ok: false, featureId, message: `Invalid or wrong-feature task: ${taskId}` };
    }

    if (!acquireLock(featureId, taskId)) {
      return { ok: false, featureId, message: 'Could not acquire lock for task' };
    }

    try {
      await TaskStore.update(taskId, { status: 'in_progress' });
      currentFeature = await FeatureStore.getById(featureId);
      if (!currentFeature) {
        return { ok: false, featureId, message: 'Feature missing' };
      }
      await transition(currentFeature, 'dev_in_progress', 'dev-lead');
      post('DEV_TASK_STARTED', { featureId, taskId, taskTitle: task.title });

      const devAgentContext = { task: { ...task, status: 'in_progress' as const }, feature: currentFeature };
      const devAgentResult = await runDevAgentTask(devAgentContext);
      let devAgentParsed = devAgentResult.command;
      if (!devAgentParsed) {
        const pr = parseDevAgentOutput(devAgentResult.raw);
        devAgentParsed = pr.ok ? pr.value : null;
      }

      if (!devAgentParsed) {
        await AuditLog.append({
          timestamp: new Date().toISOString(),
          role: 'orchestrator',
          action: 'dev_agent_parse_error',
          payload: { featureId, taskId, parseError: devAgentResult.parseError },
          featureId,
          taskId,
        });
        return { ok: false, featureId, message: devAgentResult.parseError ?? 'Failed to parse Dev Agent output' };
      }

      if (devAgentParsed.type === 'BLOCKED') {
        await TaskStore.update(taskId, { status: 'blocked', blockers: devAgentParsed.blockers });
        return { ok: false, featureId, message: `Dev Agent blocked: ${devAgentParsed.reason}` };
      }

      const evidence = await checkEvidence(devAgentParsed.filesChanged, _workspacePath);
      if (!evidence.ok) {
        await TaskStore.update(taskId, {
          status: 'blocked',
          blockers: [`Evidence check failed — missing files: ${evidence.missingFiles.join(', ')}`],
        });
        post('EVIDENCE_MISSING', {
          featureId,
          taskId,
          missingFiles: evidence.missingFiles,
        });
        return { ok: false, featureId, message: 'Dev Agent reported files not found on disk' };
      }

      const now = new Date().toISOString();
      await TaskStore.update(taskId, {
        status: 'done',
        filesChanged: devAgentParsed.filesChanged,
        implementationNotes: devAgentParsed.implementationNotes,
        confidence: devAgentParsed.confidence,
        assumptions: devAgentParsed.assumptions,
        completedAt: now,
        updatedAt: now,
      });
      completedTaskCount += 1;

      currentFeature = await FeatureStore.getById(featureId);
      if (!currentFeature) {
        return { ok: false, featureId, message: 'Feature missing after task complete' };
      }
      await transition(currentFeature, 'dev_task_complete', 'dev-agent');
      post('DEV_TASK_COMPLETE', {
        featureId,
        taskId,
        taskTitle: task.title,
        filesChanged: devAgentParsed.filesChanged,
      });

      const remaining = (await TaskStore.getByFeatureId(featureId)).filter((t) => t.status === 'todo');
      currentFeature = await FeatureStore.getById(featureId);
      if (!currentFeature) {
        return { ok: false, featureId, message: 'Feature missing' };
      }
      if (remaining.length > 0) {
        await transition(currentFeature, 'dev_queue', 'orchestrator');
        currentFeature = await FeatureStore.getById(featureId) ?? currentFeature;
      } else {
        const allTasksForConf = await TaskStore.getByFeatureId(featureId);
        const confResult = checkCompletedTasksConfidence(allTasksForConf);
        if (!confResult.pass) {
          post('CONFIDENCE_WARNING', {
            featureId,
            lowConfidenceTasks: confResult.lowConfidenceTaskIds,
          });
          return { ok: false, featureId, message: confResult.reason };
        }
        await transition(currentFeature, 'dev_integrated', 'orchestrator');
        post('DEV_CYCLE_COMPLETE', { featureId, taskCount: completedTaskCount });
        startTestCycle(featureId, _workspacePath, postMessage).catch(() => {
          // Errors logged and surfaced via postMessage; avoid unhandled rejection
        });
        return { ok: true, featureId, taskCount: completedTaskCount };
      }
    } finally {
      releaseLock(featureId, taskId);
    }
  }
}
