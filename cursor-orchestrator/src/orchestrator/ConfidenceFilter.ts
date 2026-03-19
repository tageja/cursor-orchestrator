import type { Confidence, Task } from '../state/types';

/** Single-task confidence gate: low blocks integration-only flows elsewhere. */
export type ConfidenceResult = { pass: true } | { pass: false; reason: string };

/**
 * Returns pass: false if confidence is explicitly low (blocks relying on this task alone).
 * Null confidence is treated as pass (unknown / not set).
 * @param confidence Task confidence after Dev Agent TASK_DONE
 */
export function checkConfidence(confidence: Confidence | null): ConfidenceResult {
  if (confidence === 'low') {
    return { pass: false, reason: 'Task marked low confidence; PM review required before feature integration.' };
  }
  return { pass: true };
}

/** Aggregate result for all done tasks on a feature before dev_integrated. */
export type CompletedTasksConfidenceResult =
  | { pass: true }
  | { pass: false; reason: string; lowConfidenceTaskIds: string[] };

/**
 * Blocks dev_integrated if any task with status done has confidence low.
 * Does not block individual task completion to dev_task_complete.
 * @param tasks All tasks for the feature
 */
export function checkCompletedTasksConfidence(tasks: Task[]): CompletedTasksConfidenceResult {
  const doneLow = tasks.filter((t) => t.status === 'done' && t.confidence === 'low');
  if (doneLow.length === 0) {
    return { pass: true };
  }
  return {
    pass: false,
    reason: `${doneLow.length} completed task(s) have low confidence; PM review required before integration.`,
    lowConfidenceTaskIds: doneLow.map((t) => t.taskId),
  };
}
