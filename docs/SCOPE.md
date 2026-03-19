# Cursor Orchestrator — Scope

## What This Extension Does

The Cursor Orchestrator is a VS Code extension that runs inside Cursor. It acts as an AI project orchestrator: the user talks only to a **Product Manager (PM)** agent in a single chat panel. The extension's TypeScript code (the orchestrator) decides which AI agent to invoke next, injects narrow context (task + allowed files + state), and persists all project state in JSON files under `.ai-workspace/` in the user's workspace. Chat history is not the source of truth; the state store is.

The orchestrator enforces a strict state machine for features and tasks, ensures only one dev agent works at a time, and triggers a 60-minute PM review during which all agents pause until the PM (and thus the user) explicitly resumes.

## Agent Hierarchy

- **You (human)** — Only you interact with the system via the PM Chat.
- **Product Manager** — The only agent that talks to you. Can pause/resume, approve scope, approve completion. Cannot write code or mark tasks done by itself.
- **Product Lead** — Breaks scope into features and tasks, assigns work to Dev Lead and Test Manager. Cannot talk to you. Cannot approve its own work.
- **Dev Lead** — Splits features into byte-sized tasks, assigns one dev agent at a time, marks feature integrated when all tasks are done. Cannot mark feature as business-accepted.
- **Dev Agent(s)** — Implement only assigned tasks and only in allowed files. Report completion via handoff. Cannot send work to testing directly.
- **Test Manager** — Writes test cases, assigns tests to Test Agent. Cannot change product scope.
- **Test Agent(s)** — Execute tests, report pass/fail and bugs. Cannot approve business readiness.

## 60-Minute Pause Mechanic

Every 60 minutes the orchestrator pauses all non-PM agents, sets project state to a "PM review" mode, and invokes the PM with a synthesized report (from state files, not chat). The PM summarizes progress and asks you for decisions if needed. Work resumes only when you (through the PM) trigger resume. No automatic resume.

## How the User Interacts

- **Single entry point**: One sidebar panel with one chat input. All communication goes to the PM.
- **Scope**: User describes what they want; PM confirms scope and gets approval.
- **Progress**: PM reports status at each review; user approves, redirects, or clarifies.
- **No direct access** to Dev Lead, Dev Agent, Test Manager, or Test Agent — they are internal workers.

## What Phase 1 Delivers

- VS Code extension scaffold (package.json, tsconfig, esbuild, extension.ts).
- State store: ProjectStore, FeatureStore, TaskStore, AuditLog — all reading/writing `.ai-workspace/` in the workspace root.
- State machine with 13 feature states and transition guards (TransitionGuard).
- Stub DashboardProvider: sidebar view with placeholder "Loading..." HTML.
- Command `orchestrator.initWorkspace` that creates `.ai-workspace/` with project.json, features.json, tasks.json, audit-log.jsonl.

## What Phase 2 Delivers

- PM prompt builder (`buildPMPrompt`) that injects current project state into a `LanguageModelChatMessage[]`.
- Output parser with Zod schema for PMCommand (CREATE_FEATURE, APPROVE_SCOPE, PAUSE, RESUME, CLARIFY, STATUS_REPORT).
- AgentRunner: calls `vscode.lm.selectChatModels`, streams response, parses with zod, logs to AuditLog.
- Full DashboardProvider: loads webview from dist, postMessage bridge USER_MESSAGE → AgentRunner → AGENT_REPLY.
- Webview: React app with PMChat panel (input, message list, send button).
- Handling of CREATE_FEATURE: creates feature in FeatureStore and reflects in UI.

## What Phases 3–8 Deliver (Not Built in Phase 1–2)

- **Phase 3**: AgentRouter, LockManager, Product Lead prompt and parser, wire Product Lead after PM APPROVE_SCOPE.
- **Phase 4+**: Remaining agent roles (Dev Lead, Dev Agent, Test Manager, Test Agent), 60-minute Scheduler, full dashboard (FeatureBoard, AgentStatus, AuditTrail), validation layer (EvidenceChecker, ConfidenceFilter), hardening (file locks, bug-to-origin tracing).
