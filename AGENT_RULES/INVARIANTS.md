# INVARIANTS.md: TODA Management & Information System

This document specifies the strict operational, structural, and security invariants for the TODA Management and Information System. Every invariant defined here must be enforced at the database layer (PostgreSQL / RLS / Check Constraints) or strictly validated within the API and client state machines.

---

## 1. Identity, Roster & Versioning Invariants

- **INV-ID-01: Global Body Number Uniqueness**
  `drivers.body_number` must be globally unique across all registered records. No two active or historical driver records may share the same body number.
- **INV-ID-02: Driver-Vehicle Binding Is Identity-Anchored**
  A single `body_number` corresponds directly to an anchor record in `drivers`. Drivers and body numbers are bound 1:1; vehicle reassignment requires updating the profile version or registering a distinct unit identity.
- **INV-ID-03: Strict Append-Only Versioning (SCD-2)**
  Driver profile modifications (name, contact number, driver photo, tricycle photo) must **never** overwrite existing rows in place. Every modification inserts a new row into `driver_profile_versions` with an auto-incrementing integer `version = current_version + 1`, and atomically updates `drivers.current_version`. Past versions remain immutable and permanently queryable.
- **INV-ID-04: Zero Hard Deletions**
  Physical `DELETE` statements on `drivers` and `driver_profile_versions` are strictly disallowed. Profiles can only transition through states (`active`, `suspended`, `inactive`). Inactive or retired profiles are visually greyed out but remain fully intact for historical auditing.
- **INV-ID-05: Suspension Gate**
  A driver whose status is `suspended` or `inactive` must be rejected or strictly prevented from being dispatched during the controller launch lookup flow.
- **INV-ID-06: Foreign Key Referential Permanence**
  Every dispatch transaction points to `drivers.id` (UUID). Deletion of an identity anchor that holds associated historical transactions is prohibited by foreign key constraints (`ON DELETE RESTRICT`).

---

## 2. Controller & Dispatch Loop Invariants

- **INV-DISP-01: Positive Integer Multiplier**
  The launch multiplier `launch_count` must be an integer strictly greater than zero ($N \ge 1$). Database check constraint: `CHECK (launch_count > 0)`.
- **INV-DISP-02: Sanity Threshold Intercept**
  If a controller enters a `launch_count` greater than the dynamic threshold (default: $\text{threshold} > 10$, configurable via `system_settings`), the UI must block immediate submission and require explicit secondary confirmation.
- **INV-DISP-03: Double-Submission Prevention**
  The controller entry client must debounce submissions by at least **1,500ms** after pressing Submit/Enter to eliminate accidental rapid double-taps.
- **INV-DISP-04: Unrestricted Turnaround Interval**
  Drivers are permitted to launch consecutively without arbitrary turnaround intervals. The system imposes no physical cool-down period between dispatches for the same `body_number`.
- **INV-DISP-05: Server-Authoritative Timestamps**
  All dispatch timestamps (`logged_at`) must be generated authoritatively by the database server using `DEFAULT NOW()`. Client-side timestamps are rejected for ledger creation.
- **INV-DISP-06: Universal Time Normalization (UTC / GMT+8)**
  All stored timestamps are recorded in `TIMESTAMPTZ` (UTC). Operational views, daily audit reports, and day-boundary rollups must normalize explicitly to `Asia/Manila` (UTC+8 / GMT+8). Day boundaries are evaluated from `00:00:00+08` to `23:59:59+08`.
- **INV-DISP-07: Mandatory Controller Attribution**
  Every record in `dispatch_logs` must be bound to a valid, active, and authenticated `auth.users.id` representing the on-duty controller. Anonymous, unassigned, or system-spoofed inserts are rejected.
- **INV-DISP-08: Sub-2-Second Transaction Latency**
  The dispatch lookup and submission cycle must be optimized for continuous high-throughput operations (1,500–2,500 daily slots). Client search queries must match against local memory/cache or indexed single-table lookups, ensuring total interaction latency per entry remains below 2 seconds.

---

## 3. Log Immutability, Grace Periods & Correction Invariants

- **INV-LOG-01: Controller 2-Minute Undo Grace Window**
  Controllers are permitted to undo an erroneous entry within a dynamic grace window (default: $T \le 2\text{ minutes}$, defined in `system_settings.controller_undo_window_minutes`).
- An undo operation does **not** delete the row. It sets `is_voided = TRUE`, records `voided_at = NOW()`, sets `voided_by = auth.uid()`, and captures an optional reason.
- Once `NOW() - logged_at > controller_undo_window_minutes`, update attempts by the controller role must be rejected by PostgreSQL RLS.

- **INV-LOG-02: Auditor 36-Hour Revision Window**
  Officials and auditors possess an administrative grace period (default: $T \le 36\text{ hours}$ from the close of that operational day) to append reconciliation adjustments or mark discrepancies. Once this window elapses, the day's dispatch ledger becomes completely immutable across all roles.
- **INV-LOG-03: No Physical Record Purging**
  Physical `DELETE` execution is forbidden on `dispatch_logs`. Every void, adjustment, or correction is captured as an additive state update or compensating ledger row, retaining the full timeline of who initiated the action and when.
- **INV-LOG-04: Finite Controller Realtime Feed**
  The controller client interface queries and retains only the most recent **50 records** generated during the active shift (`LIMIT 50`). Historical records beyond the top 50 are evicted from client memory to prevent performance degradation on mobile terminals.

---

## 4. Security, POLP & Access Control (RBAC/ABAC)

- **INV-SEC-01: Principle of Least Privilege (POLP) per Role**
- **Controller:**
- **Read:** Minimal driver summary fields only (`id`, `body_number`, active profile version `full_name`, `driver_photo_url`, `status`).
- **Write:** Single-row `INSERT` into `dispatch_logs`. Restricted `UPDATE` on self-created entries exclusively within the 2-minute grace window.
- **Restricted:** No access to association financial rollups, other controllers' logs, or roster management.

- **Official / Auditor:**
- **Read:** Unrestricted read-only access to dispatch archives, historical versions, hourly aggregations, and driver rosters.
- **Write:** Restricted to appending reconciliation notes/audits within the 36-hour grace window. No write access to live dispatch creation.

- **Executive Board (Chairman / Secretary):**
- Full administrative authority over member onboarding, role grants, capability assignments, and dynamic configuration thresholds.

- **INV-SEC-02: Database-Enforced Authorization (RLS)**
  All security boundaries, POLP rules, and time-based grace windows must be enforced via PostgreSQL Row-Level Security (RLS) policies and `SECURITY DEFINER` functions. Client-side route guards serve strictly as UI conveniences, not security boundaries.
- **INV-SEC-03: Stateless, Secure Cookie Sessions**
  Authentication tokens (JWTs) must be persisted strictly in `httpOnly`, `Secure`, and `SameSite=Lax` cookies managed via `@supabase/ssr`. Authentication tokens must never be stored in browser `localStorage` or `sessionStorage`.
- **INV-SEC-04: Non-Escalation of Privileges**
  No user role can grant, update, or elevate user permissions beyond their own hierarchy level. Self-assignment of administrative roles is rejected at the database layer.

---

## 5. Network, Offline & Query Optimization Invariants

- **INV-NET-01: Single-Roundtrip Join Efficiency**
  Analytical and audit queries for daily reports must utilize deterministic single-roundtrip joins between `dispatch_logs`, `drivers`, `driver_profile_versions`, and `auth.users`, avoiding N+1 query patterns.
- **INV-NET-02: Roster Snapshotting & Local Caching**
  Because member profile edits occur infrequently, the controller terminal must cache the active roster locally (`body_number` index map). Typahead queries must evaluate against this client-side dataset to sustain operation across intermittent terminal 4G/5G signal drops.
- **INV-NET-03: Bounded Ingest Payloads**
  All requests submitted by the controller client must consist of compact, scalar payloads (`driver_id`, `launch_count`). Large binary blobs or uncompressed media must never traverse the dispatch ingest pipeline. All profile photos must be pre-compressed client-side (target $\le 100\text{ KB}$ WebP) and stored in cloud object storage, never as raw database records.
