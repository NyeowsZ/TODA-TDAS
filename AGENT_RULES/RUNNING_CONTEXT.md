# RUNNING_CONTEXT.md — Agent Self-Context Log

> **Purpose**: Living document maintained by the AI agent to track accumulated context, decisions made, current progress, open questions, and session-to-session continuity for the Dacotoda (TODA) Management & Information System.
>
> **Last Updated**: 2026-10-10T17:54+08:00

---

## 1. Project Identity

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Project Name**  | Dacotoda Management & Information System                              |
| **Workspace**     | `c:\Users\JV\Desktop\DacotodaManagementSystem`                        |
| **Domain**        | TODA (Tricycle Operators and Drivers Association) dispatch operations |
| **Region/Locale** | Philippines — timezone `Asia/Manila` (UTC+8 / GMT+8)                  |
| **Target Users**  | Controllers (dispatch booth), Officials/Auditors, Executive Board     |

---

## 2. Architecture Snapshot

| Layer       | Technology                      | Notes                                                     |
| ----------- | ------------------------------- | --------------------------------------------------------- |
| Framework   | Next.js (App Router)            | Server Components for analytics, Client for terminal I/O  |
| Hosting     | Vercel                          | Serverless, edge-deployed                                 |
| Database    | PostgreSQL via Supabase (Pro)   | RLS-enforced, append-only ledger, SCD-2 versioning        |
| Auth        | Supabase Auth (`@supabase/ssr`) | httpOnly cookie sessions, role-based (RBAC/ABAC)          |
| State/Cache | TanStack React Query            | In-memory driver roster cache, optimistic dispatch feed   |
| UI/Styling  | Tailwind CSS + shadcn/ui        | Modern rounded minimalist design system (see SYSTEM_UIUX) |
| Storage     | Supabase Storage                | WebP-compressed driver/unit photos (<=100KB)              |
| Type Safety | Supabase CLI auto-gen types     | `types/supabase.ts`                                       |

---

## 3. Core Domain Concepts

- **Body Number**: Unique identifier for each tricycle unit/driver — the primary lookup key at the dispatch terminal.
- **Dispatch / Launch**: A single event of logging a driver's departure. Controller enters body number + launch count (usually 1).
- **Launch Multiplier**: Number of launches per dispatch entry (default 1, sanity-checked at >10).
- **SCD-2 Versioning**: Driver profiles are never overwritten; every change creates a new version row in `driver_profile_versions`.
- **Append-Only Ledger**: `dispatch_logs` rows are never deleted. Corrections use soft-void (`is_voided = TRUE`).
- **Grace Windows**: Controller undo = 2 min, Auditor adjustments = 36 hours (both configurable via `system_settings`).

---

## 4. Key Roles & Permissions Summary

| Role               | Can Dispatch | Can Undo (2m) | Can View Audit | Can Adjust (36h) | Can Manage Drivers | Can Change Settings |
| ------------------ | ------------ | ------------- | -------------- | ---------------- | ------------------ | ------------------- |
| Controller         | Yes          | Yes           | No             | No               | No                 | No                  |
| Official / Auditor | No           | No            | Yes            | Yes              | No                 | No                  |
| Secretary          | No           | No            | Yes            | Yes              | Yes                | No                  |
| Chairman           | No           | No            | Yes            | Yes              | Yes                | Yes                 |

---

## 5. Critical Invariants to Never Violate

1. **No hard deletes** on `drivers`, `driver_profile_versions`, or `dispatch_logs` — ever.
2. **Server-authoritative timestamps** — `logged_at` from `NOW()`, never from client.
3. **RLS is the security boundary**, not client-side route guards.
4. **httpOnly cookies only** — no `localStorage`/`sessionStorage` for auth tokens.
5. **Sub-2-second dispatch cycle** — body number lookup must be from local memory cache.
6. **1,500ms debounce** on dispatch submission to prevent double-taps.
7. **UTC storage, GMT+8 display** — all timestamps stored as `TIMESTAMPTZ`, displayed in `Asia/Manila`.

---

## 6. Design System Key Rules

- **60-30-10 color rule**: Canvas neutrals (60%), structural slate text/borders (30%), single blue accent `#2563EB` (10%).
- **Hyper-rounded geometry**: `rounded-full` for buttons/chips, `rounded-2xl` for cards/inputs, `rounded-3xl` for hero cards.
- **No pure black** (`#000000`), no pure white canvas — use `#0F172A` and `#F8FAFC`.
- **No emoji** anywhere in the UI.
- **48px minimum touch targets** for controller terminal buttons.
- **Font stack**: Plus Jakarta Sans / Inter for body, JetBrains Mono for body numbers & timestamps.
- **No notched/split input borders** — clean vertical label-above-field stacks.

---

## 7. Database Tables (Quick Reference)

| Table                     | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `system_settings`         | Dynamic config (thresholds, grace windows)             |
| `user_profiles`           | Maps `auth.users` to app role + active status          |
| `drivers`                 | Identity anchor (body_number, current_version, status) |
| `driver_profile_versions` | Immutable SCD-2 history of driver details              |
| `dispatch_logs`           | Append-only dispatch ledger                            |
| `audit_adjustments`       | 36-hour correction records by officials                |

---

## 8. Current Progress

### Phase: Full System Implementation Complete

- [x] INVARIANTS.md — Full invariants specification written
- [x] SYSTEM_ARCHITECTURE.md — Tech stack, DB schema, RLS policies, directory layout defined
- [x] SYSTEM_FLOW.md — All workflows documented (registration, dispatch loop, audit reconciliation)
- [x] SYSTEM_UIUX.md — Complete design system with color tokens, typography, component blueprints
- [x] RUNNING_CONTEXT.md — Agent self-context file created and updated
- [x] Project scaffolding (Next.js 16 with App Router, Turbopack, Tailwind CSS v4)
- [x] Supabase project setup & complete schema migration (`toda-app/supabase/schema.sql`)
- [x] In-memory driver cache hook (`use-driver-cache.ts`) with Realtime sync (<5ms lookup)
- [x] Grace window countdown hook (`use-grace-timer.ts`)
- [x] Keyboard navigation hook (`use-keyboard-nav.ts`)
- [x] Controller terminal page & components (`controller-terminal.tsx`, `driver-match-card.tsx`, `dispatch-keypad.tsx`, `recent-feed.tsx`, `undo-confirm-modal.tsx`)
- [x] Official Audit ledger & reconciliation dashboard (`audit-dashboard.tsx`, 36-hour adjustment modal)
- [x] Official Dispatch Analytics & rush-hour insights (`analytics-dashboard.tsx`, Top 10 Leaderboard)
- [x] Driver Roster & Unit Directory (`drivers-roster.tsx`, WebP client compression <=100KB, registration)
- [x] SCD-2 Driver Version History timeline (`driver-version-history.tsx`, immutable versions)
- [x] Dynamic System Settings (`system-settings.tsx`, Chairman grace windows & threshold config)
- [x] Auth flow implementation (`auth-actions.ts`, login page, role-based navigation)
- [x] PWA configuration (`manifest.json`, viewport settings)
- [x] TypeScript validation (`npx tsc --noEmit` — 0 errors)
- [x] Production build validation (`npm run build` — 10/10 routes passing)
- [x] Controller terminal submission bugfix (eliminated premature success flash, preserved error banner, added Realtime subscription)
- [x] Admin audit & analytics live updates (added Supabase Realtime channel subscription + cache revalidation)
- [x] Supabase security linter fix (`ALTER VIEW view_driver_active_summaries SET (security_invoker = true)`)
- [x] Created `quick_fix.sql` for instant one-click execution in Supabase SQL Editor

- [x] Implemented reference Dacotoda attendance system workflow (`DONOTPUSH/dacotoda-daily-attendance-to-masterlist` parity):
  - [x] Omnibox search (`omnibox-search.tsx`) with `/` or `Ctrl+K` hotkey, live instant typeahead dropdown matching body number and driver name, and Enter-to-dispatch.
  - [x] Physical clipboard parity with 90-line sheet pagination pill (`[ ← ] [ Sheet X: 1–90 ] [ → ]`) matching physical Philippine TODA tally sheets.
  - [x] Live Stack Control Sheet (`live-stack-feed.tsx`) with grouped consecutive runs (`Line 1–2 (x2)`), interactive steppers (`-` / `+`), and in-line trip count editing.
  - [x] Quick Driver Registration Modal (`quick-driver-modal.tsx`) with 1-click "Save & Dispatch" directly from search query.
  - [x] Clean Output & Masterlist Reconciliation Tab (`clean-output-tab.tsx`) in Official Audit with click-to-reconcile checklist (localStorage persisted), CSV export, and print formatting.
  - [x] Server action `updateRunTripCount` maintaining immutable ledger rules while allowing in-window quantity adjustments.

---

## 9. Decisions & Notes Log

| Date       | Decision / Note                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| 2026-10-10 | Read all 4 AGENT_RULES files. Created RUNNING_CONTEXT.md.                                            |
| 2026-10-10 | Initialized Next.js App Router app (`toda-app`) on branch `dev`.                                     |
| 2026-10-10 | Implemented strict 60-30-10 color tokens & hyper-rounded typography in `globals.css`.                |
| 2026-10-10 | Built sub-2s dispatch loop terminal with local memory Map lookup, 1500ms debounce, >10 sanity check. |
| 2026-10-10 | Implemented SCD-2 driver versioning with append-only immutable history and WebP image compression.   |
| 2026-10-10 | Built Official Audit dashboard with 36-hour adjustment workflow and rush hour hourly chart.          |
| 2026-10-10 | Created complete SQL schema (`supabase/schema.sql`) with RLS enforcement at DB engine.               |
| 2026-10-10 | Verified full TypeScript compilation and production Next.js build (10/10 routes passing).            |
| 2026-10-10 | Fixed controller submission error masking and added live Supabase Realtime sync to audit/analytics.  |
| 2026-10-10 | Created `supabase/quick_fix.sql` resolving Security Definer View warning and RLS policy evaluation.  |
| 2026-10-10 | Re-architected controller input flow to match `DONOTPUSH/dacotoda-daily-attendance-to-masterlist` (Omnibox hotkey, 90-line sheet pagination, consecutive run grouping, inline stepper editing, clean output reconciliation). |

---

## 10. Open Questions / Next Steps

- **Supabase credentials**: Populate `.env.local` with real `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Run quick fix**: Execute `supabase/quick_fix.sql` in the Supabase SQL Editor to clear the critical security linter warning and sync all user accounts into `user_profiles`.
- **Git PR & Merge**: User reviews branch `dev` and merges into `main`.

---

_This file is maintained by the AI agent. It will be updated as the project progresses._

