# Cursor Orchestrator — Schemas

All runtime state and agent outputs conform to these shapes. TypeScript types live in `cursor-orchestrator/src/state/types.ts`. Zod schemas for validation live in `cursor-orchestrator/src/agents/parsers/outputParser.ts` (and related).

## project.json

```json
{
  "projectId": "string",
  "name": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "status": "active | paused_for_review"
}
```

## features.json (array of Feature)

```json
{
  "featureId": "string (e.g. FEAT-001)",
  "title": "string",
  "description": "string",
  "status": "draft_scope | approved_scope | dev_planned | dev_queue | dev_in_progress | dev_task_complete | dev_integrated | ready_for_test | test_cases_written | testing | test_passed | test_failed | pm_review | approved_done | rejected",
  "priority": "high | medium | low",
  "approvedBy": "string | null",
  "approvedAt": "ISO8601 | null",
  "tasks": ["TASK-001", "..."],
  "allowedFiles": ["glob or path"],
  "blockedFiles": ["glob or path"],
  "testCaseFile": "string | null",
  "testResultFile": "string | null",
  "bugs": ["bugId"],
  "devLeadSignoff": "string | null",
  "pmSignoff": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

## tasks.json (array of Task)

```json
{
  "taskId": "string (e.g. TASK-001)",
  "featureId": "string",
  "title": "string",
  "description": "string",
  "ownerAgent": "dev-agent | ...",
  "status": "todo | in_progress | done | blocked",
  "allowedFiles": ["path"],
  "implementationNotes": "string | null",
  "filesChanged": ["path"],
  "blockers": ["string"],
  "confidence": "high | medium | low | null",
  "assumptions": ["string"],
  "evidenceFiles": ["path"],
  "dependsOn": ["taskId"],
  "handoffTo": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "completedAt": "ISO8601 | null"
}
```

## handoff.json (per handoff)

```json
{
  "handoffId": "string",
  "taskId": "string",
  "featureId": "string",
  "fromRole": "string",
  "toRole": "string",
  "status": "string",
  "summary": "string",
  "filesChanged": ["path"],
  "confidence": "high | medium | low",
  "assumptions": ["string"],
  "missingInformation": ["string"],
  "evidenceFiles": ["path"],
  "risks": ["string"],
  "bugs": [],
  "recommendedNextAction": "string",
  "createdAt": "ISO8601"
}
```

## bug.json (for bugs array or separate file)

```json
{
  "bugId": "string",
  "taskId": "string",
  "featureId": "string",
  "severity": "high | medium | low",
  "description": "string",
  "files": ["path"],
  "testCaseId": "string | null",
  "retestRequired": true
}
```

## PM Command Output (parsed from PM agent response)

One of the following (discriminated by `type`):

- `{ "type": "CREATE_FEATURE", "title": "string", "description": "string", "priority": "high" | "medium" | "low" }`
- `{ "type": "APPROVE_SCOPE", "featureId": "string" }`
- `{ "type": "PAUSE", "reason": "string" }`
- `{ "type": "RESUME", "featureId": "string" }`
- `{ "type": "CLARIFY", "question": "string" }`
- `{ "type": "STATUS_REPORT", "summary": "string", "blockers": ["string"], "decisions": [{ "question": "string", "options": ["string"] }] }`

The PM must respond with valid JSON in this shape so the orchestrator can apply the command.

## audit-log.jsonl (one JSON object per line)

```json
{"timestamp": "ISO8601", "role": "string", "action": "string", "payload": {}, "featureId": "string | null", "taskId": "string | null"}
```
