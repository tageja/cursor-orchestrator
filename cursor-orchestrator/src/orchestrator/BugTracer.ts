import type { Task } from '../state/types';

/** Bug shape from Test Agent output (before tracing). */
export interface BugInput {
  description: string;
  severity: 'high' | 'medium' | 'low';
  files: string[];
}

/** Bug with optional originating dev task id. */
export interface TracedBug extends BugInput {
  originTaskId: string | null;
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').trim().toLowerCase();
}

function pathsMatch(taskPath: string, bugPath: string): boolean {
  const a = normalize(taskPath);
  const b = normalize(bugPath);
  if (!a || !b) return false;
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

/**
 * Links each bug to the most recently completed task that listed a matching path in filesChanged.
 * @param bugs Test Agent bug list
 * @param tasks All feature tasks (typically from TaskStore.getByFeatureId)
 */
export function traceBugs(bugs: BugInput[], tasks: Task[]): TracedBug[] {
  const doneTasks = tasks
    .filter((t) => t.status === 'done')
    .sort((x, y) => {
      const ax = x.completedAt ?? '';
      const ay = y.completedAt ?? '';
      return ay.localeCompare(ax);
    });

  return bugs.map((bug) => {
    let originTaskId: string | null = null;
    outer: for (const file of bug.files) {
      for (const t of doneTasks) {
        for (const fc of t.filesChanged) {
          if (pathsMatch(fc, file)) {
            originTaskId = t.taskId;
            break outer;
          }
        }
      }
    }
    return { ...bug, originTaskId };
  });
}

/**
 * Single-line string for feature.bugs[] including origin when known.
 */
export function formatBugForFeature(traced: TracedBug): string {
  const prefix = traced.originTaskId != null ? `[origin:${traced.originTaskId}] ` : '';
  return `${prefix}${traced.severity}: ${traced.description}`;
}
