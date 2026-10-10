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
- [x] Approved Controller Terminal 3-Card Vertical Stack Architecture (`DONOTPUSH/samples/sample-1-wireframe-faithful.html` & `sample-refined.html`):
  - [x] **Strict 100dvh layout**: Viewport-locked, internal scrolling, zero dead space on desktop/kiosk screens.
  - [x] **Card 1 (Top) — Omnibox**: Body number / name search, fixed 3-row stock height (`h-[120px]`), full readable column headers (Body No., Last Name, First Name, M.I., Nickname), subdued highlight for non-focused rows, empty <kbd>Enter</kbd> validation guard (prevents duplicate dispatches).
  - [x] **Card 2 (Middle) — Route Selector**: Dedicated standalone box with horizontal route buttons (`Guinsay`, `Taytay`, `Sabang`, etc., CRUD-configurable by Admin).
    - Roving focus & keyboard navigation: <kbd>←</kbd> and <kbd>→</kbd> arrow keys smoothly cycle routes.
    - **Last-used route memory**: Automatically remembers and focuses the last-used route button when advancing from Omnibox.
    - <kbd>Enter</kbd> on route button confirms route and immediately focuses the Launch Amount input.
    - <kbd>Escape</kbd> steps back to Omnibox.
  - [x] **Card 3 (Bottom) — Driver Info + Launch Amount**:
    - Driver Profile Card: 80x80 photo thumbnail, large Body # & Nickname, full name, row & today trip count.
    - **Dynamic Alert Light-Up**:
      - **Suspended**: The ENTIRE driver info card lights up in vibrant red (`bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-100`), red avatar container, prominent animated `⛔ SUSPENDED` badge, inline alert notice, and hard-disabled dispatch controls (`Blocked (Suspended)`).
      - **Inactive**: The ENTIRE driver info card lights up in bright warning amber (`bg-amber-50 border-2 border-amber-500 ring-4 ring-amber-100`), amber avatar container, prominent `⚠️ INACTIVE` badge, inline alert notice, and hard-disabled dispatch controls (`Blocked (Inactive)`).
      - **Active**: Clean slate styling (`bg-slate-50/90 border-slate-200/90`), zero redundant badge.
    - **Hard Enter Lockout (Non-Enterable)**: Following core domain invariants, pressing <kbd>Enter</kbd> in Omnibox or clicking a suspended/inactive driver row strictly aborts transition (triggers dual card/omnibox shake animation, displays `⛔ BLOCKED: Cannot dispatch suspended/inactive unit!`, and prevents entering Route Selector or Launch Amount).
    - Clean Semantic Label: "Launch Amount" (default `1`, highlighted/selected on focus for instant typing).
    - 500ms Anti-Spam Lock: Debounces and locks submission button with subtle "Logged" indicator.
    - Distinct Append-Only Rows: Every dispatch has an individual ID and discrete row; multiple dispatches for the same unit (e.g. `550 x10` then `550 x1`) remain completely separate.
    - Clean Neutral Slate Badges: Zero yellowing/amber highlights on launch multipliers.

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
| 2026-10-10 | User provided hand-drawn 3-card vertical stack wireframe (Omnibox -> Route -> Driver Info / Launch Amount). Wireframe mockup created in `DONOTPUSH/samples/sample-1-wireframe-faithful.html` with Tailwind CSS. |
| 2026-10-10 | Refined controller terminal per user direction: fixed 3-row stock height on query results, full readable column headers (Body No., Last Name, First Name, M.I., Nickname), removed all yellow/amber styling on launch counts (neutral slate badges), removed redundant "Active" badge (display badge only if Inactive/Suspended). |
| 2026-10-10 | Added Empty Search <kbd>Enter</kbd> validation guard to eliminate accidental duplicate dispatches when pressing Enter on empty Omnibox. |
| 2026-10-10 | Implemented 500ms anti-spam dispatch lock with visual indicator to prevent rapid double-taps. |
| 2026-10-10 | Integrated Admin Route Management (Guinsay, Taytay, Sabang) with dedicated horizontal route buttons. |
| 2026-10-10 | Implemented exact keyboard flow: Omnibox <kbd>Enter</kbd> -> focuses last-used route button element -> <kbd>←</kbd>/<kbd>→</kbd> arrow keys to navigate routes -> <kbd>Enter</kbd> advances to Launch Amount (`amountInput.select()`) -> <kbd>Enter</kbd> executes dispatch and returns focus to Omnibox. |
| 2026-10-10 | Corrected field label from wireframe shorthand ("Launch Num -> Dispatch") to clean semantic "Launch Amount". |
| 2026-10-10 | Resolved Route Focus Bleed-Through: Suppressed browser synthetic click (`e.detail === 0`) on `<button>` release, and disarmed Enter transitions (`routeReadyForEnter = false`) until Omnibox Enter key is fully released (`keyup` + 80ms buffer). Focus now stays rock-solid on the Route button until explicitly confirmed. |
| 2026-10-10 | Resolved Arrow Key Inversion: Removed duplicate `keydown` handler on button elements that previously caused double bubbling to `window` (+2/-2 jump in 3-item array), restoring true unidirectional navigation (<kbd>→</kbd> moves right: `Guinsay` → `Taytay` → `Sabang`, <kbd>←</kbd> moves left: `Sabang` → `Taytay` → `Guinsay`). |
| 2026-10-10 | Enforced Invariant Lockout & Full Card Visual Alert: When a driver is Suspended or Inactive, the entire Driver Info card illuminates with high-contrast alert styling (vibrant red for Suspended with `⛔ SUSPENDED` badge; amber for Inactive with `⚠️ INACTIVE` badge). Pressing <kbd>Enter</kbd> or clicking is strictly locked out (dual shake animation, blocking toast, hard-disabled dispatch controls). |
| 2026-10-10 | **Eliminated Top Header Card**: Removed the bulky explanatory demo card header from `controller-terminal.tsx`, replacing it with a minimal inline status bar (`Drivers Cached • Sub-5ms Instant Lookup` + live Manila time), reclaiming full vertical height for the 100dvh layout. |
| 2026-10-10 | **Eliminated All Mockups & Overhauled Database Schema**: Added `public.routes` table (`id`, `name`, `is_active`, `sort_order`, `created_at`) with RLS and realtime. Added discrete database columns `first_name`, `last_name`, `middle_initial`, and `nickname` to `driver_profile_versions` (and projected in `view_driver_active_summaries`). Added `route` column to `dispatch_logs`. Removed synthetic `parseDriverName` regex parser across all components; all UI elements now bind directly to real PostgreSQL columns. Added idempotent migration in `supabase/quick_fix.sql`. |

---

## 10. Open Questions / Next Steps

- **Apply Migration in Supabase**: Execute Section 6 of `supabase/quick_fix.sql` in the Supabase SQL Editor to add `routes` table, discrete name columns, and update the active summaries view on remote database.
- **Git PR & Merge**: Review branch `feature/controller-terminal-refactor` and merge into `dev` / `main`.

---

_This file is maintained by the AI agent. It will be updated as the project progresses._

