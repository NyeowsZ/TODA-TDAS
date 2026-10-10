# RUNNING_CONTEXT.md — Agent Self-Context Log

> **Purpose**: Living document maintained by the AI agent to track accumulated context, decisions made, current progress, open questions, and session-to-session continuity for the Dacotoda (TODA) Management & Information System.
>
> **Last Updated**: 2026-10-10T17:54+08:00

---

## 1. Project Identity

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Project Name**   | Dacotoda Management & Information System                              |
| **Workspace**      | `c:\Users\JV\Desktop\DacotodaManagementSystem`                        |
| **Domain**         | TODA (Tricycle Operators and Drivers Association) dispatch operations  |
| **Region/Locale**  | Philippines — timezone `Asia/Manila` (UTC+8 / GMT+8)                  |
| **Target Users**   | Controllers (dispatch booth), Officials/Auditors, Executive Board     |

---

## 2. Architecture Snapshot

| Layer          | Technology                        | Notes                                                      |
| -------------- | --------------------------------- | ---------------------------------------------------------- |
| Framework      | Next.js (App Router)              | Server Components for analytics, Client for terminal I/O   |
| Hosting        | Vercel                            | Serverless, edge-deployed                                  |
| Database       | PostgreSQL via Supabase (Pro)     | RLS-enforced, append-only ledger, SCD-2 versioning         |
| Auth           | Supabase Auth (`@supabase/ssr`)   | httpOnly cookie sessions, role-based (RBAC/ABAC)           |
| State/Cache    | TanStack React Query              | In-memory driver roster cache, optimistic dispatch feed    |
| UI/Styling     | Tailwind CSS + shadcn/ui          | Modern rounded minimalist design system (see SYSTEM_UIUX)  |
| Storage        | Supabase Storage                  | WebP-compressed driver/unit photos (<=100KB)               |
| Type Safety    | Supabase CLI auto-gen types       | `types/supabase.ts`                                        |

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

| Role                   | Can Dispatch | Can Undo (2m) | Can View Audit | Can Adjust (36h) | Can Manage Drivers | Can Change Settings |
| ---------------------- | ------------ | ------------- | -------------- | ---------------- | ------------------ | ------------------- |
| Controller             | Yes          | Yes           | No             | No               | No                 | No                  |
| Official / Auditor     | No           | No            | Yes            | Yes              | No                 | No                  |
| Secretary              | No           | No            | Yes            | Yes              | Yes                | No                  |
| Chairman               | No           | No            | Yes            | Yes              | Yes                | Yes                 |

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

| Table                       | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `system_settings`           | Dynamic config (thresholds, grace windows)            |
| `user_profiles`             | Maps `auth.users` to app role + active status        |
| `drivers`                   | Identity anchor (body_number, current_version, status)|
| `driver_profile_versions`   | Immutable SCD-2 history of driver details             |
| `dispatch_logs`             | Append-only dispatch ledger                           |
| `audit_adjustments`         | 36-hour correction records by officials               |

---

## 8. Current Progress

### Phase: Pre-Development (Specification Complete)

- [x] INVARIANTS.md — Full invariants specification written
- [x] SYSTEM_ARCHITECTURE.md — Tech stack, DB schema, RLS policies, directory layout defined
- [x] SYSTEM_FLOW.md — All workflows documented (registration, dispatch loop, audit reconciliation)
- [x] SYSTEM_UIUX.md — Complete design system with color tokens, typography, component blueprints
- [x] RUNNING_CONTEXT.md — Agent self-context file created
- [ ] Project scaffolding (Next.js app initialization)
- [ ] Supabase project setup & schema migration
- [ ] Core components implementation
- [ ] Auth flow implementation
- [ ] Controller terminal page
- [ ] Official/Audit dashboard pages
- [ ] Admin/Settings pages
- [ ] PWA configuration
- [ ] Testing & deployment

---

## 9. Decisions & Notes Log

| Date       | Decision / Note                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| 2026-10-10 | Read all 4 AGENT_RULES files. Project is in specification-only phase — no code exists yet.            |
| 2026-10-10 | Created RUNNING_CONTEXT.md as a living document for cross-session continuity.                         |

---

## 10. Open Questions / Pending User Input

- **Supabase project**: Does the user already have a Supabase project created, or do we need to set one up?
- **Environment variables**: Are there existing `.env` files or Supabase credentials to work with?
- **When to start building**: Is the user ready to scaffold the Next.js project, or are there more spec changes first?
- **PWA requirements**: Any specific offline-first requirements beyond the roster caching described in the specs?
- **Deployment**: Is the Vercel account already connected, or is that a future step?

---

*This file is maintained by the AI agent. It will be updated as the project progresses.*
