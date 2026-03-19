## Handoff: Phase 2 — PM Chat + vscode.lm → Phase 3

Date: 2026-03-19
Agent: Phase 2 implementation
Status: COMPLETE

### What Was Completed

- PM prompt builder (`src/agents/prompts/pm.ts`): `buildPMPrompt(context)` returns `LanguageModelChatMessage[]` with system + state + user message.
- Output parser (`src/agents/parsers/outputParser.ts`): Zod `PMCommandSchema` (discriminated union), `parseAgentOutput<T>(raw, schema)`.
- AgentRunner (`src/agents/AgentRunner.ts`): `runAgent(role, messages)` calls `vscode.lm.selectChatModels`, `model.sendRequest`, streams response, parses with PMCommandSchema, logs to AuditLog, returns `AgentResult`.
- Full DashboardProvider: loads HTML from `dist/webview/index.html` (with URI rewrite for assets), injects no script (VS Code provides `acquireVsCodeApi` in webview context). On `USER_MESSAGE`: inits stores if needed, builds PM context, runs PM agent, on `CREATE_FEATURE` adds feature via FeatureStore and posts `FEATURES_UPDATED`; always posts `AGENT_REPLY` with raw body or error.
- Webview: Vite + React app in `webview/` — `App.tsx`, `PMChat.tsx`, `MessageBubble.tsx`, `types/messages.ts`, `main.tsx`, `index.html`. Build output: `cursor-orchestrator/dist/webview/`.

### Files Created (exact paths)

- cursor-orchestrator/src/agents/prompts/pm.ts
- cursor-orchestrator/src/agents/parsers/outputParser.ts
- cursor-orchestrator/src/agents/AgentRunner.ts
- cursor-orchestrator/webview/package.json
- cursor-orchestrator/webview/tsconfig.json
- cursor-orchestrator/webview/tsconfig.node.json
- cursor-orchestrator/webview/vite.config.ts
- cursor-orchestrator/webview/index.html
- cursor-orchestrator/webview/src/types/messages.ts
- cursor-orchestrator/webview/src/components/MessageBubble.tsx
- cursor-orchestrator/webview/src/panels/PMChat.tsx
- cursor-orchestrator/webview/src/App.tsx
- cursor-orchestrator/webview/src/main.tsx

### Files Modified (exact paths + what changed)

- cursor-orchestrator/src/ui/DashboardProvider.ts — replaced stub with full implementation (load webview HTML, message handler, CREATE_FEATURE handling).
- cursor-orchestrator/package.json — added `build:webview` script.
- docs/PROGRESS.md — Phase 2 section marked COMPLETE with checkboxes (in same batch as this handoff).

### Tests/Verification Done

- `cd cursor-orchestrator/webview && npm install && npm run build` succeeds; output in `cursor-orchestrator/dist/webview/`.
- `cd cursor-orchestrator && npm run build` succeeds.
- `npx eslint src extension.ts --ext .ts` passes.

### Open Issues (blocking)

- None.

### Open Issues (non-blocking)

- vscode.lm may be undefined in non-Cursor or older VS Code; AgentRunner throws a clear error. No fallback.
- Unit tests for parser and AgentRunner were not added.

### Build and run instructions

1. **Install (one-time)**  
   - `cd cursor-orchestrator && npm install`  
   - `cd webview && npm install`

2. **Build**  
   - `cd cursor-orchestrator/webview && npm run build`  
   - `cd cursor-orchestrator && npm run build`  
   Or from repo root: `cd cursor-orchestrator && npm run build:webview && npm run build`

3. **Launch in Cursor**  
   - Open the `ProductAuto` (or `cursor-orchestrator`) folder in Cursor.  
   - F5 or Run > Start Debugging to launch Extension Development Host.  
   - In the new window: open a folder, run command "Orchestrator: Initialize AI Workspace", then open the Orchestrator sidebar (PM Chat).  
   - Type a message (e.g. "Add a feature: user login"). PM response is streamed; if the model returns valid JSON with `type: "CREATE_FEATURE"`, a feature is added to `.ai-workspace/features.json`.

### Exact Next Agent Instruction (Phase 3)

You are the Phase 3 implementation agent. Your task is to implement the AgentRouter and LockManager, add the Product Lead prompt and parser, and wire the Product Lead so it is invoked after the PM sends `APPROVE_SCOPE` (and optionally after CREATE_FEATURE when the user approves scope). Do NOT change the PM chat flow or the CREATE_FEATURE handling in DashboardProvider beyond what is needed to trigger the Product Lead. Implement: `src/orchestrator/AgentRouter.ts` (decides next agent from state), `src/orchestrator/LockManager.ts` (one active dev agent at a time), `src/agents/prompts/product-lead.ts`, `src/agents/parsers/productLeadParser.ts` (or extend outputParser), and wire Product Lead invocation from the extension host when the PM command is APPROVE_SCOPE. Success criteria: when the user approves scope for a feature, Product Lead is invoked and can break the feature into tasks (and write to TaskStore). Start by reading: docs/PROGRESS.md, docs/SCOPE.md, docs/agent-handoffs/phase-02-complete.md.
