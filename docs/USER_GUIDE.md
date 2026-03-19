# Cursor Orchestrator — User Guide

## Installation

### From VSIX

1. In the project root, build and package the extension:
   - `cd cursor-orchestrator`
   - `npm install`
   - `npm run build`
   - `cd webview && npm install && npm run build && cd ..`
   - `npm run package`
2. In Cursor/VS Code: **Extensions** → **...** (More Actions) → **Install from VSIX**.
3. Select `cursor-orchestrator/cursor-orchestrator-0.1.0.vsix`.
4. Reload the window if prompted.

### From source (development)

1. Open the repo in Cursor.
2. From `cursor-orchestrator/`: `npm install`, `npm run build`, and in `webview/`: `npm install`, `npm run build`.
3. Press **F5** to launch the Extension Development Host; a new window opens with the extension loaded.

---

## First-run walkthrough

1. **Open a workspace** in Cursor (e.g. the folder containing your code).
2. **Initialize the AI workspace**: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) → run **Orchestrator: Initialize AI Workspace**. This creates `.ai-workspace/` in the workspace root with `project.json`, `features.json`, `tasks.json`, and `audit-log.jsonl`.
3. **Open the sidebar**: Click the Orchestrator icon in the activity bar (left), then open the **PM Chat** view.
4. In PM Chat, describe what you want (e.g. “Add a login page with email and password”). The PM will reply and may ask for clarification or propose scope. When ready, say something like “approve scope” so the pipeline can start.

---

## PM Chat usage

- **Single entry point**: All your interaction is with the Product Manager. You never talk directly to Dev Lead, Dev Agent, Test Manager, or Test Agent.
- **Describe scope**: Tell the PM what you want. The PM confirms scope and may create a feature (or more) and ask you to approve.
- **Approve scope**: Once you say to approve (e.g. “approve scope”), the orchestrator runs Product Lead → Dev Lead → Dev Agent(s) → Test Manager → Test Agent in sequence. Progress appears in the sidebar and in the other dashboard tabs.
- **Review and lifecycle**: When a feature is in **PM review** (e.g. after tests pass), you can say **APPROVE_DONE** to mark it done or **REJECT** to send it back to development.
- **Pause / Resume**: You can say **PAUSE** to pause the orchestrator and **RESUME** to continue. The 60-minute timer also triggers a PM review and pause; you must explicitly **RESUME** to continue.

---

## Dashboard tabs

- **PM Chat**: The only place you type. Send messages to the PM; the PM’s replies and system notifications appear here.
- **Feature Board**: List of features and their status (e.g. draft_scope, dev_in_progress, pm_review, approved_done).
- **Agent Status**: Recent audit entries (which agent did what).
- **Audit Trail**: Full reverse-chronological log of orchestrator actions (stored in `.ai-workspace/audit-log.jsonl`).

Each tab that needs data sends a request to the host when opened; the host replies with the current features list and audit entries.

---

## 60-minute review pause and resume

- When the **review interval** elapses (default 60 minutes; configurable via `orchestrator.reviewIntervalMinutes`), the orchestrator:
  - Pauses all non-PM agents.
  - Sets project status to **paused for review**.
  - Invokes the PM with a synthesized report (from state files, not chat history).
  - The PM’s summary is shown in PM Chat.
- Work does **not** resume automatically. You (or the PM on your behalf) must trigger **RESUME** to continue.
- You can also **PAUSE** manually at any time; again, **RESUME** is required to continue.

---

## APPROVE_DONE and REJECT

- When a feature is in **pm_review** (e.g. tests passed and it’s waiting for your sign-off):
  - **APPROVE_DONE**: Marks the feature as **approved_done**. Use when you accept the outcome.
  - **REJECT**: Moves the feature back to **rejected**, then to **dev_planned** so the pipeline can run again (e.g. after fixes). Use when you want rework.

The PM prompt and parser support these commands; you can say them in natural language (e.g. “approve this feature as done” or “reject and send back to dev”).

---

## Evidence and confidence validation

- **Evidence check**: When a Dev Agent reports completion with `filesChanged`, the orchestrator verifies those files exist on disk. If any are missing, it reports **EVIDENCE_MISSING** and does not advance the task (the task can be marked blocked). You’ll see a notification in PM Chat.
- **Confidence filter**: Before a feature is marked **dev_integrated**, the orchestrator checks that no completed task has **low** confidence. If any task has low confidence, it reports **CONFIDENCE_WARNING** and does not transition to integrated; the PM can then ask for rework or clarification.

These validations are automatic; you only need to react to the messages (e.g. fix missing files or improve the task before re-running).

---

## Configuration reference

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `orchestrator.reviewIntervalMinutes` | number | 60 | Minutes between automatic PM review cycles. Minimum 5. |
| `orchestrator.testRunner` | `"auto"` \| `"jest"` \| `"vitest"` \| `"none"` | `"auto"` | Test runner for the Test Agent. `auto` probes for Jest or Vitest config; `none` uses LLM simulation only. |

Open **File → Preferences → Settings** and search for “orchestrator” to change these.

---

## Troubleshooting

- **Sidebar shows “Loading…” or stays blank**  
  Ensure you’ve run **Orchestrator: Initialize AI Workspace** once in this workspace. Reload the window and open the Orchestrator view again.

- **PM doesn’t respond or commands aren’t recognized**  
  The extension uses Cursor’s language model (`vscode.lm`). Ensure you’re in Cursor with a valid subscription. Try a short message (e.g. “status”) to see if the PM replies.

- **Features/tasks don’t appear on the Feature Board**  
  Open the Feature Board tab; it requests state on focus. If the list is empty, run **Initialize AI Workspace** and create a feature via PM Chat (describe scope → approve scope).

- **Tests always “simulated” (no real Jest/Vitest)**  
  Set `orchestrator.testRunner` to `jest` or `vitest` if you want to force a runner, or ensure the workspace has a `jest.config.*` or `vitest.config.*` for `auto` to detect. Use `none` to explicitly use LLM-only mode.

- **Review timer not firing or wrong interval**  
  Check `orchestrator.reviewIntervalMinutes` in settings (minimum 5). The timer runs only while the Orchestrator sidebar has been opened in the session; closing the window stops it.

- **“.ai-workspace” is out of sync or corrupted**  
  You can delete `.ai-workspace/` in the workspace root and run **Orchestrator: Initialize AI Workspace** again. This resets project/features/tasks and audit log; any in-memory state is lost.
