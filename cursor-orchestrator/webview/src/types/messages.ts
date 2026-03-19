/**
 * Contract between webview and extension host. All postMessage payloads must match these types.
 */

/** Messages sent from webview to extension host */
export type WebviewMessage =
  | { type: 'USER_MESSAGE'; body: string }
  | { type: 'INIT' }
  | { type: 'REQUEST_STATE' };

/** Audit entry shape sent from host (matches extension AuditEntry) */
export interface AuditEntryMessage {
  timestamp: string;
  role: string;
  action: string;
  payload: unknown;
  featureId: string | null;
  taskId: string | null;
}

/** Feature list item sent from host for FeatureBoard */
export interface FeatureListItem {
  featureId: string;
  title: string;
  status: string;
  taskCount: number;
  updatedAt: string;
}

/** Messages sent from extension host to webview */
export type HostMessage =
  | { type: 'AGENT_REPLY'; body: string; error?: string }
  | { type: 'FEATURES_UPDATED'; count: number }
  | { type: 'TASKS_CREATED'; featureId: string; count: number }
  | { type: 'DEV_TASK_STARTED'; featureId: string; taskId: string; taskTitle: string }
  | { type: 'DEV_TASK_COMPLETE'; featureId: string; taskId: string; taskTitle: string; filesChanged: string[] }
  | { type: 'DEV_CYCLE_COMPLETE'; featureId: string; taskCount: number }
  | { type: 'TEST_CASES_WRITTEN'; featureId: string; count: number }
  | { type: 'TESTING_STARTED'; featureId: string }
  | { type: 'TEST_CYCLE_COMPLETE'; featureId: string; passed: boolean; bugCount: number }
  | { type: 'PM_REVIEW_STARTED'; summary: string }
  | { type: 'PAUSED'; reason: string }
  | { type: 'RESUMED'; featureId: string }
  | { type: 'FEATURES_LIST'; features: FeatureListItem[] }
  | { type: 'AUDIT_ENTRIES'; entries: AuditEntryMessage[] }
  | { type: 'EVIDENCE_MISSING'; featureId: string; taskId: string; missingFiles: string[] }
  | { type: 'CONFIDENCE_WARNING'; featureId: string; lowConfidenceTasks: string[] }
  | { type: 'FEATURE_APPROVED'; featureId: string }
  | { type: 'FEATURE_REJECTED'; featureId: string; reason: string };
