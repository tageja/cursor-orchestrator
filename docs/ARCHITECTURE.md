# Cursor Orchestrator — Architecture

## Data Flow

1. **User** types in PM Chat (webview).
2. **Webview** (PMChat.tsx) sends `postMessage` with type `USER_MESSAGE` and body to extension host.
3. **DashboardProvider** receives message, builds PM context from state store, calls **AgentRunner** with PM role and prompt from `buildPMPrompt(context)`.
4. **AgentRunner** calls `vscode.lm.selectChatModels` / chat request, streams response, accumulates full text.
5. **AgentRunner** passes raw text to **outputParser**; parser extracts JSON and validates with Zod (PMCommand schema).
6. **DashboardProvider** (or orchestrator) applies the command (e.g. CREATE_FEATURE → FeatureStore.write).
7. **StateMachine** / **TransitionGuard** validate transitions; **FeatureStore**, **AuditLog** write to disk.
8. **AgentRunner** (or DashboardProvider) sends `postMessage` with type `AGENT_REPLY` and body to webview.
9. **Webview** appends message to list and renders.

Workspace root for `.ai-workspace/`: `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`. All state paths are under that root.

## State Machine (13 Feature States)

- `draft_scope` → `approved_scope`
- `approved_scope` → `dev_planned`
- `dev_planned` → `dev_queue`
- `dev_queue` → `dev_in_progress`
- `dev_in_progress` → `dev_task_complete`
- `dev_task_complete` → `dev_queue` (next task) or `dev_integrated` (all tasks done)
- `dev_integrated` → `ready_for_test`
- `ready_for_test` → `test_cases_written`
- `test_cases_written` → `testing`
- `testing` → `test_passed` or `test_failed`
- `test_failed` → `dev_queue`
- `test_passed` → `pm_review`
- `pm_review` → `approved_done` or `rejected`
- `rejected` → `dev_planned`

Transitions are enforced in TypeScript (StateMachine + TransitionGuard). TransitionGuard checks required artifacts (e.g. `ready_for_test` requires integration note and non-empty filesChanged).

## JSON Schemas (Canonical in docs/SCHEMAS.md)

- **project.json**: project id, name, createdAt, updatedAt, status (e.g. active, paused_for_review).
- **features.json**: array of Feature (featureId, title, description, status, priority, taskIds, allowedFiles, blockedFiles, testCaseFile, testResultFile, bugs, timestamps, signoffs).
- **tasks.json**: array of Task (taskId, featureId, title, description, ownerAgent, status, allowedFiles, implementationNotes, filesChanged, blockers, confidence, assumptions, evidenceFiles, dependsOn, handoffTo, timestamps, completedAt).
- **handoff.json** (per handoff): handoffId, taskId, featureId, fromRole, toRole, status, summary, filesChanged, confidence, assumptions, missingInformation, evidenceFiles, risks, bugs, recommendedNextAction, createdAt.
- **audit-log.jsonl**: one JSON object per line (AuditEntry): timestamp, role, action, payload, featureId?, taskId?.

## .ai-workspace/ Folder (Created at Runtime)

Created by `orchestrator.initWorkspace` in the first workspace folder:

- `project.json`
- `features.json`
- `tasks.json`
- `handoffs/` (directory; optional handoff files per task/feature)
- `audit-log.jsonl`

Path: `path.join(workspaceFolderUri.fsPath, '.ai-workspace', filename)`.

## vscode.lm Integration Contract

- Use `vscode.lm.selectChatModels()` to get available models; pick one (e.g. first or by family).
- Build `vscode.LanguageModelChatMessage[]`: system message (PM role + output format), user message (current state + user message).
- Create chat request with messages; stream response. Accumulate full text.
- After stream ends, parse full text as JSON and validate with Zod. On failure, retry once with a correction prompt if desired, then surface error to user in chat.
