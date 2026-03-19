import * as path from 'path';
import * as fs from 'fs/promises';
import { FeatureStore } from '../state/FeatureStore';
import { TaskStore } from '../state/TaskStore';
import { ProjectStore } from '../state/ProjectStore';
import { AuditLog } from '../state/AuditLog';
import { transition } from './StateMachine';
import { runTestManagerAgent, runTestAgentTask } from '../agents/AgentRunner';
import { parseTestManagerOutput } from '../agents/parsers/testManagerParser';
import { parseTestAgentOutput } from '../agents/parsers/testAgentParser';
import type { PostMessageToWebview } from './DevCycleRunner';
import { traceBugs, formatBugForFeature } from './BugTracer';
import { runRealTests } from './RealTestRunner';
import type { TestAgentCommandParsed } from '../agents/parsers/testAgentParser';

const AI_WORKSPACE_DIR = '.ai-workspace';
const HANDOFFS_DIR = 'handoffs';

export interface StartTestCycleResult {
  ok: boolean;
  featureId: string;
  passed?: boolean;
  bugCount?: number;
  message?: string;
}

/**
 * Runs the test cycle for a feature: ready_for_test -> Test Manager writes cases -> Test Agent runs -> test_passed | test_failed.
 * Writes artifact files to .ai-workspace/handoffs/ to satisfy transition guards.
 * @param featureId Feature to run test cycle for (must be in dev_integrated)
 * @param workspacePath Workspace root (stores must already be inited)
 * @param postMessage Optional callback to notify webview
 * @returns Result with ok, featureId, passed, bugCount when cycle completes or message on error/blocked
 */
export async function startTestCycle(
  featureId: string,
  workspacePath: string,
  postMessage?: PostMessageToWebview
): Promise<StartTestCycleResult> {
  const post = (type: string, payload: object) => {
    if (postMessage) postMessage(type, payload);
  };

  const feature = await FeatureStore.getById(featureId);
  if (!feature) {
    return { ok: false, featureId, message: `Feature not found: ${featureId}` };
  }
  if (feature.status !== 'dev_integrated') {
    return { ok: false, featureId, message: `Feature ${featureId} is not in dev_integrated (current: ${feature.status})` };
  }

  const tasks = await TaskStore.getByFeatureId(featureId);
  const handoffsPath = path.join(workspacePath, AI_WORKSPACE_DIR, HANDOFFS_DIR);
  await fs.mkdir(handoffsPath, { recursive: true });

  const integrationPath = path.join(handoffsPath, `${featureId}-integration.md`);
  await fs.writeFile(
    integrationPath,
    `# Integration note: ${feature.title}\n\nFeature ${featureId} integrated at ${new Date().toISOString()}. All dev tasks completed.\n`,
    'utf-8'
  );

  await transition(feature, 'ready_for_test', 'orchestrator', {
    tasks,
    integrationNoteExists: true,
  });

  let currentFeature = await FeatureStore.getById(featureId);
  if (!currentFeature) {
    return { ok: false, featureId, message: 'Feature missing after transition' };
  }

  let project = null;
  try {
    project = await ProjectStore.read();
  } catch {
    // optional
  }
  const testManagerContext = { feature: currentFeature, tasks, project };
  const tmResult = await runTestManagerAgent(testManagerContext);
  let tmParsed = tmResult.command;
  if (!tmParsed) {
    const pr = parseTestManagerOutput(tmResult.raw);
    tmParsed = pr.ok ? pr.value : null;
  }

  if (!tmParsed) {
    await AuditLog.append({
      timestamp: new Date().toISOString(),
      role: 'orchestrator',
      action: 'test_manager_parse_error',
      payload: { featureId, parseError: tmResult.parseError },
      featureId,
      taskId: null,
    });
    return { ok: false, featureId, message: tmResult.parseError ?? 'Failed to parse Test Manager output' };
  }

  if (tmParsed.type === 'BLOCKED') {
    return { ok: false, featureId, message: `Test Manager blocked: ${tmParsed.reason}` };
  }

  const testCasesFilePath = path.join(handoffsPath, `${featureId}-test-cases.json`);
  await fs.writeFile(testCasesFilePath, JSON.stringify({ testCases: tmParsed.testCases }, null, 2), 'utf-8');
  const testCaseFileRelative = `${AI_WORKSPACE_DIR}/${HANDOFFS_DIR}/${featureId}-test-cases.json`;
  await FeatureStore.update(featureId, { testCaseFile: testCaseFileRelative });

  currentFeature = await FeatureStore.getById(featureId);
  if (!currentFeature) {
    return { ok: false, featureId, message: 'Feature missing' };
  }
  await transition(currentFeature, 'test_cases_written', 'test-manager');
  post('TEST_CASES_WRITTEN', { featureId, count: tmParsed.testCases.length });

  const allFilesChanged = tasks.flatMap((t) => t.filesChanged);
  let taParsed: TestAgentCommandParsed | null = null;
  let taParseError: string | null | undefined;
  const realResult = await runRealTests(allFilesChanged, workspacePath);
  if (realResult.available) {
    taParsed = {
      type: 'TEST_RESULT',
      passed: realResult.passed,
      results: realResult.results,
      bugs: realResult.bugs,
    };
  } else {
    const testAgentContext = {
      feature: currentFeature,
      testCases: tmParsed.testCases,
      filesChanged: allFilesChanged,
    };
    const taResult = await runTestAgentTask(testAgentContext);
    taParseError = taResult.parseError;
    const pr = parseTestAgentOutput(taResult.raw);
    taParsed = taResult.command ?? (pr.ok ? pr.value : null);
  }

  if (!taParsed) {
    await AuditLog.append({
      timestamp: new Date().toISOString(),
      role: 'orchestrator',
      action: 'test_agent_parse_error',
      payload: { featureId, parseError: taParseError },
      featureId,
      taskId: null,
    });
    return { ok: false, featureId, message: taParseError ?? 'Failed to parse Test Agent output' };
  }

  if (taParsed.type === 'BLOCKED') {
    return { ok: false, featureId, message: `Test Agent blocked: ${taParsed.reason}` };
  }

  const tracedBugs = traceBugs(taParsed.bugs, tasks);
  const testResultsFilePath = path.join(handoffsPath, `${featureId}-test-results.json`);
  await fs.writeFile(
    testResultsFilePath,
    JSON.stringify(
      { passed: taParsed.passed, results: taParsed.results, bugs: tracedBugs },
      null,
      2
    ),
    'utf-8'
  );
  const testResultFileRelative = `${AI_WORKSPACE_DIR}/${HANDOFFS_DIR}/${featureId}-test-results.json`;
  const bugDescriptions = tracedBugs.map((b) => formatBugForFeature(b));
  await FeatureStore.update(featureId, { testResultFile: testResultFileRelative, bugs: bugDescriptions });

  currentFeature = await FeatureStore.getById(featureId);
  if (!currentFeature) {
    return { ok: false, featureId, message: 'Feature missing' };
  }
  await transition(currentFeature, 'testing', 'test-agent');
  post('TESTING_STARTED', { featureId });

  if (taParsed.passed) {
    await transition(currentFeature, 'test_passed', 'test-agent', {
      testCaseFileExists: true,
      testResultFileExists: true,
    });
    currentFeature = await FeatureStore.getById(featureId);
    if (currentFeature) {
      await transition(currentFeature, 'pm_review', 'orchestrator');
    }
    post('TEST_CYCLE_COMPLETE', { featureId, passed: true, bugCount: 0 });
    return { ok: true, featureId, passed: true, bugCount: 0 };
  }

  await transition(currentFeature, 'test_failed', 'test-agent');
  currentFeature = await FeatureStore.getById(featureId);
  if (currentFeature) {
    await transition(currentFeature, 'dev_queue', 'orchestrator');
  }
  const bugCount = taParsed.bugs.length;
  post('TEST_CYCLE_COMPLETE', { featureId, passed: false, bugCount });
  return { ok: true, featureId, passed: false, bugCount };
}
