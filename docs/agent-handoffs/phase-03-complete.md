## Handoff: Phase 3 — AgentRouter + Product Lead → Phase 4

Date: 2026-03-19
Agent: Phase 3 implementation
Status: COMPLETE

### What Was Completed

- **AgentRouter** (`src/orchestrator/AgentRouter.ts`): `handlePMCommand(command, workspacePath)` handles `APPROVE_SCOPE` only. Loads feature, validates `draft_scope`, transitions to `approved_scope`, builds Product Lead context, calls `runProductLeadAgent(context)`, parses with `parseProductLeadOutput`. On `PLAN_TASKS`: writes tasks to TaskStore, transitions feature to `dev_planned`, updates feature.tasks array. Returns `RouterResult` with action, featureId, taskCount.
- **LockManager** (`src/orchestrator/LockManager.ts`): In-memory lock map per featureId; `acquireLock`, `releaseLock`, `isLocked`, `getActiveLock`. Not yet called from AgentRouter (Phase 4 will use it when starting dev agents).
- **Product Lead prompt** (`src/agents/prompts/product-lead.ts`): `ProductLeadContext` (feature, existingTasks, project), `buildProductLeadPrompt(context)` returns `LanguageModelChatMessage[]`.
- **Product Lead parser** (`src/agents/parsers/productLeadParser.ts`): `ProductLeadCommandSchema` (Zod: PLAN_TASKS, CLARIFY, BLOCKED), `parseProductLeadOutput(raw)`.
- **AgentRunner** (`src/agents/AgentRunner.ts`): Refactored with internal `runWithSchema<T>()`; `runAgent(role, messages)` uses PMCommandSchema and passes `role` to audit log; `runProductLeadAgent(context)` builds PL prompt and runs with ProductLeadCommandSchema.
- **DashboardProvider** (`src/ui/DashboardProvider.ts`): Added `TaskStore.init(workspacePath)`. On PM `APPROVE_SCOPE`, calls `handlePMCommand(result.command, workspacePath)`; if `product_lead_invoked`, posts `TASKS_CREATED` to webview.
- **Webview**: `messages.ts` — added `TASKS_CREATED` to HostMessage. `PMChat.tsx` — on `TASKS_CREATED`, appends agent message: "Product Lead created N task(s) for feature X."
- **Types** (`src/state/types.ts`): Added `ProductLeadCommand` discriminated union (PLAN_TASKS, CLARIFY, BLOCKED).

### Files Created (exact paths)

- cursor-orchestrator/src/orchestrator/AgentRouter.ts
- cursor-orchestrator/src/orchestrator/LockManager.ts
- cursor-orchestrator/src/agents/prompts/product-lead.ts
- cursor-orchestrator/src/agents/parsers/productLeadParser.ts
- docs/agent-handoffs/phase-03-complete.md

### Files Modified (exact paths + what changed)

- cursor-orchestrator/src/state/types.ts — added ProductLeadCommand type below PMCommand
- cursor-orchestrator/src/agents/AgentRunner.ts — runWithSchema internal, runAgent uses role, runProductLeadAgent added
- cursor-orchestrator/src/ui/DashboardProvider.ts — TaskStore.init, handlePMCommand import, APPROVE_SCOPE branch and TASKS_CREATED postMessage
- cursor-orchestrator/webview/src/types/messages.ts — TASKS_CREATED in HostMessage
- cursor-orchestrator/webview/src/panels/PMChat.tsx — message handler for TASKS_CREATED
- docs/PROGRESS.md — Phase 3 section added and marked COMPLETE with checkboxes

### Tests/Verification Done

- `npm run build` (extension) succeeds
- `npm run build` (webview) succeeds
- `npx eslint src extension.ts --ext .ts` passes with zero errors

### Open Issues (blocking)

- None.

### Open Issues (non-blocking)

- LockManager is not yet used; Phase 4 will call `acquireLock` before starting a dev agent.
- Product Lead model output must return valid JSON; if the model returns prose or malformed JSON, parse fails and user sees error in chat.

### Exact Next Agent Instruction (Phase 4)

You are the Phase 4 implementation agent. Your task is to implement the Dev Lead and Dev Agent flow: when a feature is in `dev_planned` with tasks in `dev_queue`, the orchestrator should invoke the Dev Lead to pick the next task, then invoke the Dev Agent to implement it. Use LockManager: before starting a dev agent, call `acquireLock(featureId, taskId)`; when the dev agent completes, call `releaseLock(featureId, taskId)`. Implement: Dev Lead prompt and parser (output: assign task, transition to dev_in_progress), Dev Agent prompt and parser (output: task done with filesChanged), and wire them from AgentRouter or a new orchestration step. Do NOT change the PM or Product Lead flow. Success criteria: one dev task can be selected by Dev Lead and executed by Dev Agent; task status and filesChanged are written to TaskStore; only one dev agent is active at a time per feature (LockManager). Start by reading: docs/PROGRESS.md, docs/SCOPE.md, docs/agent-handoffs/phase-03-complete.md.
