# Cursor Orchestrator

AI project orchestrator for Cursor: a single PM Chat drives a multi-agent workflow (Product Lead, Dev Lead, Dev Agent, Test Manager, Test Agent). State is persisted in `.ai-workspace/`; a 60-minute review pause keeps the PM in control.

## Requirements

- **Cursor** (or VS Code 1.74+)
- Workspace opened in Cursor

## Installation

1. Build the extension: `npm run build && npm run build:webview` (from `cursor-orchestrator/`).
2. Package: `npm run package` → produces `cursor-orchestrator-0.1.0.vsix`.
3. Install: **Extensions** → **...** → **Install from VSIX** → select the `.vsix` file.

## Quick Start

1. Open a workspace in Cursor.
2. Run **Orchestrator: Initialize AI Workspace** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Open the **Orchestrator** sidebar (activity bar) and select **PM Chat**.
4. Describe what you want; the PM will confirm scope. Say "approve scope" to start the pipeline. Product Lead → Dev Lead → Dev Agent(s) → Test Manager → Test Agent run automatically; you only talk to the PM.

## Configuration

| Setting | Description |
|--------|-------------|
| `orchestrator.reviewIntervalMinutes` | Minutes between automatic PM review cycles (default: 60, minimum: 5). |
| `orchestrator.testRunner` | `auto` (probe for Jest/Vitest), `jest`, `vitest`, or `none` (LLM simulation only). |

## Agent Hierarchy

```
You (human)
 └── Product Manager [only agent you talk to]
     └── Product Lead
         ├── Dev Lead → Dev Agent(s)
         └── Test Manager → Test Agent(s)
```

- **PM**: Pause/resume, approve scope, approve done, reject. Does not write code.
- **Product Lead**: Breaks scope into features/tasks; cannot talk to you.
- **Dev Lead**: Splits features into tasks; one dev at a time.
- **Dev Agent**: Implements assigned tasks in allowed files only.
- **Test Manager**: Writes test cases.
- **Test Agent**: Runs tests (real Jest/Vitest when configured, else LLM simulation); reports pass/fail and bugs.

For a detailed walkthrough, see the project's `docs/USER_GUIDE.md`.
