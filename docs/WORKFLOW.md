# Multi-Agent Workflow Guide

## Overview

This document describes the end-to-end workflow for running a multi-agent development project in Cursor. The human user manages agents by opening Cursor agent sessions and pointing each agent to the appropriate rule files. Agents communicate exclusively through CSV tracking files — never through chat.

## Architecture

```
┌─────────────┐
│  Human User │
│  (you)      │
└──────┬──────┘
       │ chat
       ▼
┌──────────────┐       ┌──────────────────────────────────┐
│  Project     │──────▶│  docs/tracking/                   │
│  Manager     │◀──────│  ├── task-tracker.csv             │
│  (PM)        │       │  ├── test-cases.csv               │
└──────┬───────┘       │  ├── bug-register.csv             │
       │ creates       │  └── session-log.csv              │
       │ tasks         │  (shared state — all agents R/W)  │
       ▼               └───────────────▲───────────────────┘
┌──────────────┐                       │
│  Dev Agents  │───────────────────────┤ update status
│  ┌─ UI/UX    │                       │
│  ├─ Backend  │                       │
│  └─ Fullstack│                       │
└──────┬───────┘                       │
       │ features done                 │
       ▼                               │
┌──────────────┐                       │
│ Test Manager │───────────────────────┤ file bugs
│ Test Agent(s)│                       │
└──────────────┘                       │
       │ bugs found                    │
       ▼                               │
┌──────────────┐                       │
│  Dev Agents  │───────────────────────┘ fix bugs
│  (bug fixes) │
└──────────────┘
```

## Step-by-Step Workflow

### Phase 1: Project Setup (Human + PM)

1. **Human** opens a Cursor agent session.
2. **Human** tells the agent: *"You are the Project Manager. Read `.cursor/rules/10-general-all-agents.mdc` and `.cursor/rules/11-project-manager.mdc`. Let's create a PRD."*
3. **PM** reads the rules, then works with the human to create `docs/PRD.md` using `docs/templates/PRD-TEMPLATE.md`.
4. **PM** fills in: product overview, tech stack, branding, features (with IDs like `FEAT-001`), database schema, API endpoints, environment variables.
5. **Human** reviews and approves the PRD.

### Phase 2: Task Planning (PM)

1. **PM** analyzes the PRD and breaks each feature into implementation tasks.
2. **PM** creates rows in `docs/tracking/task-tracker.csv` — one per task, with:
   - Unique `task_id` (e.g. `TASK-001`)
   - `feature_id` linking to the PRD
   - `assigned_to` (which dev agent role)
   - `allowed_files` (file scope for the agent)
   - Detailed `description`
3. **PM** creates or updates role-specific rule files if needed (e.g. adding project-specific sections to `12a-ui-ux-engineer.mdc`).
4. **PM** tells the human exactly which agent sessions to create:

```
📋 Create these agent sessions:

1. UI/UX Engineer — "Read .cursor/rules/10-general-all-agents.mdc and 
   .cursor/rules/12a-ui-ux-engineer.mdc (which includes 12-dev-agent-shared.mdc).
   Your assigned tasks: TASK-001, TASK-002, TASK-003. Begin work."

2. Backend Engineer — "Read .cursor/rules/10-general-all-agents.mdc and 
   .cursor/rules/12b-backend-engineer.mdc. 
   Your assigned tasks: TASK-004, TASK-005, TASK-006. Begin work."
```

### Phase 3: Development (Dev Agents)

1. **Human** opens new Cursor agent sessions for each dev agent, pasting the PM's instructions.
2. Each **Dev Agent**:
   - Reads its rule files and the PRD.
   - Reads `task-tracker.csv` to find assigned tasks.
   - Picks up tasks one at a time (respecting `depends_on`).
   - Updates status to `in_progress` when starting.
   - Implements the code within `allowed_files`.
   - Verifies: build passes, lint passes.
   - Updates status to `done`, fills `files_changed` and `completed_at`.
   - Appends actions to `session-log.csv`.
3. Dev agents work in parallel — they don't step on each other because `allowed_files` are non-overlapping.

### Phase 4: Status Check (Human + PM)

1. **Human** returns to the PM session.
2. **Human** says: *"Dev Agent 2 has finished."* (or: *"Check status."*)
3. **PM** reads `task-tracker.csv` and `session-log.csv`.
4. **PM** reports which tasks are done, which are in progress, and which are blocked.
5. **PM** verifies all tasks for a feature are `done` before proceeding to testing.

### Phase 5: Test Planning (Test Manager)

1. **PM** tells the human to create a Test Manager session.
2. **Human** opens a session: *"You are the Test Manager. Read `.cursor/rules/10-general-all-agents.mdc` and `.cursor/rules/13-test-manager.mdc`. Features FEAT-001 and FEAT-002 are ready for testing. Begin test planning."*
3. **Test Manager**:
   - Reads the PRD acceptance criteria.
   - Creates test cases in `test-cases.csv` — happy path, edge cases, negatives.
   - Assigns each test case (`assigned_to` = `test-manager` or `test-agent`).

### Phase 6: Test Execution (Test Manager / Test Agents)

1. **Test Manager** executes test cases assigned to themselves.
2. For larger projects, **human** creates Test Agent sessions.
3. Each **Test Agent**:
   - Reads `test-cases.csv` for assigned test cases.
   - Executes each test, records results.
   - Files bugs in `bug-register.csv` for failures.
4. All results are written to `test-cases.csv` and `bug-register.csv`.

### Phase 7: Bug Fix Cycle (Dev ↔ Test — No PM Needed)

This is the key efficiency loop — dev and test agents collaborate directly through CSV files:

```
┌─────────────┐      bug-register.csv       ┌─────────────┐
│ Test Agent   │──── status: open ──────────▶│  Dev Agent   │
│              │                             │              │
│              │◀─── status: fixed ──────────│              │
│              │                             │              │
│  retests     │──── status: closed ─────────│  done!       │
│     or       │         or                  │              │
│              │──── status: open (again) ───│  tries again │
│              │                             │              │
│  after 2     │──── status: escalated ──────│              │
│  failures    │         ↓                   │              │
│              │      PM intervenes          │              │
└─────────────┘                              └─────────────┘
```

**How it works in practice:**
1. Test Agent files a bug → Dev Agent picks it up next time they check `bug-register.csv`.
2. Dev Agent fixes it, sets `status=fixed`.
3. Human tells Test Agent: *"Check bug-register for fixed bugs and retest."*
4. If retest passes → `status=closed`. If fails → `status=open`, `attempts` incremented.
5. After 2 failed attempts → `status=escalated`. Human tells PM to review.

### Phase 8: Release Decision (Human + PM)

1. **Human** asks PM for release readiness.
2. **PM** reads:
   - `test-cases.csv` — all tests for the release features must be `passed`.
   - `bug-register.csv` — no `open` or `in_progress` bugs with severity `critical` or `high`.
3. **PM** gives go/no-go recommendation.
4. **Human** makes the final call.

## Quick Reference: Agent Startup Prompts

Copy-paste these when creating agent sessions:

### Project Manager
```
You are the Project Manager. Read .cursor/rules/10-general-all-agents.mdc and 
.cursor/rules/11-project-manager.mdc. Then read docs/PRD.md and all files in 
docs/tracking/. Summarize current project status.
```

### UI/UX Engineer
```
You are the UI/UX Engineer. Read .cursor/rules/10-general-all-agents.mdc, 
.cursor/rules/12-dev-agent-shared.mdc, and .cursor/rules/12a-ui-ux-engineer.mdc. 
Then read docs/PRD.md and docs/tracking/task-tracker.csv. Find your assigned tasks 
and begin work.
```

### Backend Engineer
```
You are the Backend Engineer. Read .cursor/rules/10-general-all-agents.mdc, 
.cursor/rules/12-dev-agent-shared.mdc, and .cursor/rules/12b-backend-engineer.mdc. 
Then read docs/PRD.md and docs/tracking/task-tracker.csv. Find your assigned tasks 
and begin work.
```

### Fullstack Engineer
```
You are the Fullstack Engineer. Read .cursor/rules/10-general-all-agents.mdc, 
.cursor/rules/12-dev-agent-shared.mdc, and .cursor/rules/12c-fullstack-engineer.mdc. 
Then read docs/PRD.md and docs/tracking/task-tracker.csv. Find your assigned tasks 
and begin work.
```

### Test Manager
```
You are the Test Manager. Read .cursor/rules/10-general-all-agents.mdc and 
.cursor/rules/13-test-manager.mdc. Then read docs/PRD.md, 
docs/tracking/task-tracker.csv, docs/tracking/test-cases.csv, and 
docs/tracking/bug-register.csv. Begin test planning for completed features.
```

### Test Agent
```
You are the Test Agent. Read .cursor/rules/10-general-all-agents.mdc and 
.cursor/rules/14-test-agent.mdc. Then read docs/PRD.md, 
docs/tracking/test-cases.csv, and docs/tracking/bug-register.csv. Execute your 
assigned test cases.
```

## File Map

```
.cursor/rules/
├── 10-general-all-agents.mdc    ← Universal rules (always active)
├── 11-project-manager.mdc       ← PM role definition
├── 12-dev-agent-shared.mdc      ← Shared dev agent rules
├── 12a-ui-ux-engineer.mdc       ← UI/UX specialization
├── 12b-backend-engineer.mdc     ← Backend specialization
├── 12c-fullstack-engineer.mdc   ← Fullstack specialization
├── 13-test-manager.mdc          ← Test Manager role
├── 14-test-agent.mdc            ← Test Agent role
└── 15-reporting-protocol.mdc    ← CSV schemas & communication rules (always active)

docs/
├── PRD.md                       ← Product requirements (created per-project)
├── WORKFLOW.md                  ← This file
├── templates/
│   └── PRD-TEMPLATE.md          ← Template for new PRDs
└── tracking/
    ├── task-tracker.csv          ← Task assignments & status
    ├── test-cases.csv            ← Test definitions & results
    ├── bug-register.csv          ← Bug reports & resolution
    └── session-log.csv           ← Chronological action log
```
