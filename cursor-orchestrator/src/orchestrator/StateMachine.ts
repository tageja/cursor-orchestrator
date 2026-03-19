import type { Feature, FeatureStatus } from '../state/types';
import { FeatureStore } from '../state/FeatureStore';
import { AuditLog } from '../state/AuditLog';
import { validate as guardValidate } from './TransitionGuard';
import type { TransitionContext } from './TransitionGuard';

/**
 * All legal feature state transitions: from -> set of allowed to states.
 */
export const VALID_TRANSITIONS: Record<FeatureStatus, readonly FeatureStatus[]> = {
  draft_scope: ['approved_scope'],
  approved_scope: ['dev_planned'],
  dev_planned: ['dev_queue'],
  dev_queue: ['dev_in_progress'],
  dev_in_progress: ['dev_task_complete'],
  dev_task_complete: ['dev_queue', 'dev_integrated'],
  dev_integrated: ['ready_for_test'],
  ready_for_test: ['test_cases_written'],
  test_cases_written: ['testing'],
  testing: ['test_passed', 'test_failed'],
  test_passed: ['pm_review'],
  test_failed: ['dev_queue'],
  pm_review: ['approved_done', 'rejected'],
  approved_done: [],
  rejected: ['dev_planned'],
};

/**
 * Returns whether a transition from one status to another is allowed by the state machine.
 * @param from Current status
 * @param to Desired status
 * @returns true if the transition is legal
 */
export function canTransition(from: FeatureStatus, to: FeatureStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(to);
}

/**
 * Applies a feature status transition: validates via TransitionGuard, updates FeatureStore, appends AuditLog.
 * @param feature Feature to transition
 * @param newStatus Target status
 * @param actor Role or id performing the transition
 * @param context Optional context for artifact validation (tasks, artifact flags)
 * @returns Promise that resolves when done; throws if transition is invalid
 */
export async function transition(
  feature: Feature,
  newStatus: FeatureStatus,
  actor: string,
  context?: Partial<TransitionContext>
): Promise<void> {
  const from = feature.status;
  if (!canTransition(from, newStatus)) {
    throw new Error(`Invalid transition: ${from} -> ${newStatus}`);
  }
  const fullContext: TransitionContext = {
    feature,
    tasks: context?.tasks,
    integrationNoteExists: context?.integrationNoteExists,
    testCaseFileExists: context?.testCaseFileExists,
    testResultFileExists: context?.testResultFileExists,
  };
  const guardError = guardValidate(from, newStatus, fullContext);
  if (guardError) {
    throw new Error(`Transition guard: ${guardError}`);
  }
  const updated = { ...feature, status: newStatus, updatedAt: new Date().toISOString() };
  await FeatureStore.update(feature.featureId, { status: newStatus, updatedAt: updated.updatedAt });
  await AuditLog.append({
    timestamp: new Date().toISOString(),
    role: actor,
    action: 'feature_transition',
    payload: { from, to: newStatus, featureId: feature.featureId },
    featureId: feature.featureId,
    taskId: null,
  });
}
