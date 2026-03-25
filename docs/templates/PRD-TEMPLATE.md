# Product Requirements Document (PRD)

> **Instructions**: The PM agent creates this document with the human user. Replace all `[bracketed]` placeholders. Delete this instructions block when done.

## 1. Product Overview

**Product Name**: [Product Name]
**Version**: [0.1.0]
**Last Updated**: [YYYY-MM-DD]
**Status**: `draft` | `approved` | `in_progress` | `complete`

### 1.1 Problem Statement
[What problem does this product solve? Who has this problem? Why is it worth solving?]

### 1.2 Product Vision
[One-paragraph vision of the product — what it looks like when it's done and successful.]

### 1.3 Target Users
[Who are the primary users? What are their key characteristics?]

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | [e.g. React, React Native/Expo, Next.js] | |
| **Backend** | [e.g. Node/Express, Python/FastAPI, Supabase] | |
| **Database** | [e.g. PostgreSQL, Supabase, Airtable, SQLite] | |
| **Auth** | [e.g. Supabase Auth, Clerk, custom JWT] | |
| **Hosting** | [e.g. Vercel, AWS, Fly.io] | |
| **Other** | [e.g. Stripe, SendGrid, etc.] | |

## 3. Branding & Design

### 3.1 Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `primary` | [#0B5FFF] | CTA buttons, links, active states |
| `secondary` | [#6B7280] | Secondary actions, muted text |
| `background` | [#FFFFFF] | Page background |
| `surface` | [#F9FAFC] | Card/panel backgrounds |
| `text-primary` | [#333333] | Headings, body text |
| `text-secondary` | [#6B7280] | Captions, labels |
| `error` | [#DC2626] | Error states, destructive actions |
| `success` | [#16A34A] | Success states, confirmations |
| `warning` | [#F59E0B] | Warnings, cautions |

### 3.2 Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Heading 1 | [Inter/System] | [28px] | Bold |
| Heading 2 | [Inter/System] | [24px] | Semi-bold |
| Subtitle | [Inter/System] | [20px] | Medium |
| Body | [Inter/System] | [16px] | Regular |
| Caption | [Inter/System] | [12px] | Regular |

### 3.3 Spacing & Layout
- Base unit: [8px]
- Spacing scale: [8, 16, 24, 32, 48, 64]
- Border radius: Cards [8px], Inputs [4px], Pills [9999px]
- Max content width: [1200px]

### 3.4 Icon Library
[MaterialIcons | Lucide | Heroicons | Phosphor — pick one, use only that]

## 4. Features

> List every feature with a unique ID. These IDs are used in `task-tracker.csv` and `test-cases.csv`.

### FEAT-001: [Feature Name]
**Priority**: `critical` | `high` | `medium` | `low`
**Description**: [What this feature does from the user's perspective.]

**Acceptance Criteria**:
- [ ] [Criterion 1 — specific and testable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

**UI Requirements**: [Describe screens, components, interactions — or write "N/A"]
**API Requirements**: [Describe endpoints, payloads — or write "N/A"]
**Database Requirements**: [Describe tables, fields — or write "N/A"]

---

### FEAT-002: [Feature Name]
**Priority**: `critical` | `high` | `medium` | `low`
**Description**: [...]

**Acceptance Criteria**:
- [ ] [...]

**UI Requirements**: [...]
**API Requirements**: [...]
**Database Requirements**: [...]

---

> Copy the feature block above for each additional feature.

## 5. Database Schema

> Define tables/collections. If using a hosted DB like Supabase or Airtable, specify the exact table structure.

### Table: [table_name]
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PK, auto-generated | |
| `created_at` | timestamp | NOT NULL, default NOW() | |
| [column] | [type] | [constraints] | [description] |

## 6. API Endpoints

> Define the API surface. Remove this section if the project has no custom API.

| Method | Path | Auth | Description | Request Body | Response |
|--------|------|------|-------------|-------------|----------|
| GET | /api/[resource] | [yes/no] | [description] | N/A | `[type]` |
| POST | /api/[resource] | [yes/no] | [description] | `{ field: type }` | `[type]` |

## 7. Environment Variables

> List every env var the project needs. These go in `.env` (gitignored) and `.env.example` (committed).

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `DATABASE_URL` | DB connection string | `postgresql://...` | Yes |
| [VAR_NAME] | [description] | [example] | [Yes/No] |

## 8. Non-Functional Requirements

- **Performance**: [e.g. Page load < 2s, API response < 500ms]
- **Security**: [e.g. All inputs validated, auth required for mutations]
- **Accessibility**: [e.g. WCAG 2.1 AA compliance]
- **Browser/Platform Support**: [e.g. Chrome, Firefox, Safari latest 2 versions; iOS 15+, Android 12+]

## 9. Out of Scope

> Explicitly list what this version does NOT include (prevents scope creep).

- [Thing that might be expected but is NOT being built]
- [Another thing]

## 10. Open Questions

> Things that need decisions before or during implementation.

| # | Question | Decision | Decided By | Date |
|---|----------|----------|-----------|------|
| 1 | [question] | [pending/answer] | [PM/human] | |
