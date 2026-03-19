import type { Feature, FeatureStatus, Task } from '../state/types';

/** Context passed to validate a state transition */
export interface TransitionContext {
  feature: Feature;
  tasks?: Task[];
  integrationNoteExists?: boolean;
  testCaseFileExists?: boolean;
  testResultFileExists?: boolean;
}

/**
 * Valid transitions: from -> to. Only these pairs are allowed.
 * ready_for_test and test_passed require artifact checks in validate().
 */
const TRANSITION_ARTIFACTS: Partial<Record<FeatureStatus, (ctx: TransitionContext) => string | null>> = {
  ready_for_test: (ctx) => {
    if (!ctx.feature.tasks?.length) return 'Feature has no tasks';
    if (ctx.tasks?.every((t) => t.filesChanged?.length === 0)) return 'No task has filesChanged';
    if (!ctx.integrationNoteExists) return 'Integration note required before ready_for_test';
    return null;
  },
  test_passed: (ctx) => {
    if (!ctx.testCaseFileExists) return 'Test case file required';
    if (!ctx.testResultFileExists) return 'Test result file required';
    return null;
  },
};

/**
 * Validates that a transition is allowed given current context (artifacts).
 * @param from Current feature status
 * @param to Desired feature status
 * @param context Transition context (feature, tasks, artifact flags)
 * @returns null if valid, or an error message string
 */
export function validate(
  from: FeatureStatus,
  to: FeatureStatus,
  context: TransitionContext
): string | null {
  const check = TRANSITION_ARTIFACTS[to];
  if (check) {
    const err = check(context);
    if (err) return err;
  }
  return null;
}
