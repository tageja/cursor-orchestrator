/**
 * Central type definitions for the Cursor Orchestrator.
 * All shared types live here; do not redefine elsewhere.
 */

export const FEATURE_STATUS_VALUES = [
  'draft_scope',
  'approved_scope',
  'dev_planned',
  'dev_queue',
  'dev_in_progress',
  'dev_task_complete',
  'dev_integrated',
  'ready_for_test',
  'test_cases_written',
  'testing',
  'test_passed',
  'test_failed',
  'pm_review',
  'approved_done',
  'rejected',
] as const;

export type FeatureStatus = (typeof FEATURE_STATUS_VALUES)[number];

export const TASK_STATUS_VALUES = ['todo', 'in_progress', 'done', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export const AGENT_ROLE_VALUES = [
  'project-manager',
  'product-lead',
  'dev-lead',
  'dev-agent',
  'test-manager',
  'test-agent',
] as const;
export type AgentRole = (typeof AGENT_ROLE_VALUES)[number];

export const PRIORITY_VALUES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITY_VALUES)[number];

export const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

export const PROJECT_STATUS_VALUES = ['active', 'paused_for_review'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export interface Project {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
}

export interface Feature {
  featureId: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: Priority;
  approvedBy: string | null;
  approvedAt: string | null;
  tasks: string[];
  allowedFiles: string[];
  blockedFiles: string[];
  testCaseFile: string | null;
  testResultFile: string | null;
  bugs: string[];
  devLeadSignoff: string | null;
  pmSignoff: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  taskId: string;
  featureId: string;
  title: string;
  description: string;
  ownerAgent: AgentRole;
  status: TaskStatus;
  allowedFiles: string[];
  implementationNotes: string | null;
  filesChanged: string[];
  blockers: string[];
  confidence: Confidence | null;
  assumptions: string[];
  evidenceFiles: string[];
  dependsOn: string[];
  handoffTo: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Handoff {
  handoffId: string;
  taskId: string;
  featureId: string;
  fromRole: string;
  toRole: string;
  status: string;
  summary: string;
  filesChanged: string[];
  confidence: Confidence;
  assumptions: string[];
  missingInformation: string[];
  evidenceFiles: string[];
  risks: string[];
  bugs: unknown[];
  recommendedNextAction: string;
  createdAt: string;
}

export interface AuditEntry {
  timestamp: string;
  role: string;
  action: string;
  payload: unknown;
  featureId: string | null;
  taskId: string | null;
}

/** PM command discriminated union — parsed from PM agent JSON output */
export type PMCommand =
  | { type: 'CREATE_FEATURE'; title: string; description: string; priority: Priority }
  | { type: 'APPROVE_SCOPE'; featureId: string }
  | { type: 'PAUSE'; reason: string }
  | { type: 'RESUME'; featureId: string }
  | { type: 'CLARIFY'; question: string }
  | {
      type: 'STATUS_REPORT';
      summary: string;
      blockers: string[];
      decisions: Array<{ question: string; options: string[] }>;
    }
  | { type: 'APPROVE_DONE'; featureId: string }
  | { type: 'REJECT'; featureId: string; reason: string };

/** Product Lead command — parsed from Product Lead agent JSON output */
export type ProductLeadCommand =
  | {
      type: 'PLAN_TASKS';
      featureId: string;
      tasks: Array<{
        title: string;
        description: string;
        allowedFiles: string[];
        dependsOn: string[];
        priority: Priority;
      }>;
    }
  | { type: 'CLARIFY'; question: string }
  | { type: 'BLOCKED'; reason: string };

/** Dev Lead command — parsed from Dev Lead agent JSON output */
export type DevLeadCommand =
  | { type: 'ASSIGN_TASK'; taskId: string }
  | { type: 'BLOCKED'; reason: string };

/** Dev Agent command — parsed from Dev Agent agent JSON output */
export type DevAgentCommand =
  | {
      type: 'TASK_DONE';
      filesChanged: string[];
      implementationNotes: string;
      confidence: Confidence;
      assumptions: string[];
    }
  | { type: 'BLOCKED'; reason: string; blockers: string[] };

/** Test Manager command — parsed from Test Manager agent JSON output */
export type TestManagerCommand =
  | {
      type: 'WRITE_TEST_CASES';
      testCases: Array<{
        id: string;
        title: string;
        steps: string[];
        expectedResult: string;
      }>;
    }
  | { type: 'BLOCKED'; reason: string };

/** Test Agent command — parsed from Test Agent agent JSON output */
export type TestAgentCommand =
  | {
      type: 'TEST_RESULT';
      passed: boolean;
      results: Array<{ id: string; title: string; passed: boolean; notes: string }>;
      bugs: Array<{
        description: string;
        severity: 'high' | 'medium' | 'low';
        files: string[];
      }>;
    }
  | { type: 'BLOCKED'; reason: string; blockers: string[] };
