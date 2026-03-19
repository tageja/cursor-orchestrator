/**
 * In-memory lock per feature: only one dev agent task can be active at a time per feature.
 * Phase 3 builds this; Phase 4 will call acquireLock before starting a dev agent.
 */
const locks = new Map<string, string | null>();

/**
 * Attempts to acquire the lock for a feature on behalf of a task.
 * @param featureId Feature id
 * @param taskId Task id that will hold the lock
 * @returns true if lock was acquired, false if feature already has an active task
 */
export function acquireLock(featureId: string, taskId: string): boolean {
  const current = locks.get(featureId);
  if (current !== undefined && current !== null) {
    return false;
  }
  locks.set(featureId, taskId);
  return true;
}

/**
 * Releases the lock for a feature when the given task completes.
 * @param featureId Feature id
 * @param taskId Task id that held the lock (must match to release)
 */
export function releaseLock(featureId: string, taskId: string): void {
  const current = locks.get(featureId);
  if (current === taskId) {
    locks.set(featureId, null);
  }
}

/**
 * Returns whether the feature currently has an active task lock.
 * @param featureId Feature id
 * @returns true if a task holds the lock
 */
export function isLocked(featureId: string): boolean {
  const current = locks.get(featureId);
  return current !== undefined && current !== null;
}

/**
 * Returns the taskId that currently holds the lock for the feature, or null.
 * @param featureId Feature id
 * @returns Active task id or null
 */
export function getActiveLock(featureId: string): string | null {
  return locks.get(featureId) ?? null;
}
