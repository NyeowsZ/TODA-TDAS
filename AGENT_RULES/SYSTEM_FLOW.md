# WORKFLOW_SPEC.md: TODA Management & Information System

This document outlines the detailed workflows, state transitions, payload contracts, and error-handling procedures across the three core operational boundaries:

1. **The Information System (Core Data, Admin & Onboarding Engine)**
2. **The Controller (Fast Dispatch Terminal)**
3. **The Officials & Audit Board (Oversight & Daily Reconciliation)**

---

## Part 1: The Information System (Core Data & Admin Engine)

The Information System provides the single source of truth. It manages identities, immutable versioning, system thresholds, and access control.

```
       [ Official / Admin UI ]
                  │
                  ▼
      [ Validate Form & Image ]
   (Compress Image Client-Side ≤100KB)
                  │
                  ▼
     [ Begin Atomic Transaction ]
                  │
                  ├──► 1. Check `body_number` uniqueness
                  ├──► 2. Insert into `drivers` (Anchor row)
                  ├──► 3. Insert into `driver_profile_versions` (v1)
                  └──► 4. Upload photo to Object Storage Bucket
                  │
                  ▼
         [ Commit & Invalidate ]
     (Broadcast roster update to clients)

```

### 1.1 Driver Registration & Identity Initialization

- **Actor:** Secretary, Chairman, or Authorized Administrative Staff.
- **Pre-conditions:**
- Authenticated user has the `manage_drivers` capability.
- Driver is physically present with their TODA body number and franchise details.

#### Operational Flow:

1. **Data Intake:** Staff inputs `body_number`, `full_name`, and `contact_number`.
2. **Asset Compression:** Driver face photo and unit photo are captured via camera/file picker. Client compresses both to WebP format ($\le 100\text{ KB}$ each) before upload.
3. **Collision Detection:** The database checks if `body_number` already exists in `drivers`:

- _If match found:_ Transaction aborts; returns `409 Conflict: Body Number already registered`.

4. **Atomic Profile Creation:**

- Step A: Insert root anchor into `drivers` with `current_version = 1`, `status = 'active'`.
- Step B: Insert identity payload into `driver_profile_versions` (`version = 1`, `driver_photo_url`, `unit_photo_url`, `changed_by = auth.uid()`, `change_reason = 'Initial Registration'`).
- Step C: Store image binaries in Supabase Storage (`/driver-photos/{driver_id}/v1_face.webp`).

5. **Cache Invalidation:** Triggers an invalidation event so controllers pull the updated active roster cache.

---

### 1.2 Driver Profile Modification (SCD-2 Versioning Flow)

- **Actor:** Authorized Official.
- **Trigger:** Driver changes vehicle, changes contact info, or updates ID photo.

```text
[ Update Requested ]
        │
        ├──► Fetch current `drivers.current_version` (e.g., v1)
        ├──► Increment version pointer: target_version = 2
        ├──► INSERT INTO `driver_profile_versions` (version = 2, new_data, changed_by, reason)
        └──► UPDATE `drivers` SET current_version = 2, updated_at = NOW()

```

- **Invariant Guarantee:** Historical dispatch logs point to `drivers.id`. When generating audit snapshots for past months, queries join `driver_profile_versions` where `version` matches the driver's historical snapshot at that specific timestamp, ensuring name or plate changes never distort past legal audits.

---

### 1.3 Driver Status Mutation (Suspension / Inactive)

- **Actor:** Chairman / Disciplinary Board.
- **Flow:**

1. Official selects driver by Body Number.
2. Submits state transition: `status: 'suspended'` with mandatory reason text (e.g., _"30-day suspension: route violation"_).
3. `drivers.status` is set to `'suspended'`.
4. The client-side cache immediately syncs the status flag. Any future controller lookup displays a blocking red state card.

---

## Part 2: The Controller (Terminal Dispatch Loop)

The Controller workflow is optimized for speed, reliability under poor network conditions, and high repetition (1,500–2,500 launches/day).

```
   [ Controller View: Focus in Body # ]
                    │
                    ▼
          [ Type Body # (e.g. 42) ]
                    │
         (Lookup in Local Memory)
                    │
         ┌──────────┴──────────┐
   [ Found Active ]       [ Suspended / Not Found ]
         │                     │
         ▼                     ▼
[ Render Match Card ]    [ Show Error Alert ]
(Photo, Name, Body #)    [ Inhibit Submit ]
         │
         ▼
[ Enter Launch Count ] ──► [ Check > Threshold (10)? ]
                                ├─► YES: Confirm Prompt
                                └─► NO: Continue
                                       │
                                       ▼
                       [ Enter / Submit (Debounced 1500ms) ]
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
          [ Background Optimistic Sync ]       [ Prepend to Top 50 Feed ]
          - POST to `dispatch_logs`            - 2-min countdown timer starts
          - Sync timestamp via Server          - [Undo] button rendered
                     │                                   │
                     ▼                                   ▼
             [ Database Confirms ]             [ 2 Minutes Expired ]
             - Returns permanent ID            - Undo button disappears
                                               - Record permanently locked

```

### 2.1 The Rapid Launch Entry Loop

- **Hardware Profile:** Android tablet / Budget smartphone / Laptop with external USB numeric keypad.
- **Target Speed:** $\le 2\text{ seconds}$ per driver.

#### Step-by-Step Flow:

1. **Default State:** The search input `input[name="body_number"]` is permanently auto-focused.
2. **Instant Local Lookup:** Controller types the Body Number. As characters are entered, the system queries the **in-memory cached roster** (fetched once at shift start):

- _Active Driver Match:_ Renders a high-contrast card showing Driver Face Photo, Full Name, Body Number, and a green `ACTIVE` pill.
- _Suspended Driver Match:_ Renders a red `SUSPENDED` banner. The submit action is hard-disabled.
- _Not Found:_ Shows `Unregistered Body Number`. Submit is disabled.

3. **Multiplier Input:**

- Controller presses `Tab` or taps the launch count field. Default value is `1`.
- Fast preset buttons are available: `[ 1 ]`, `[ 2 ]`, `[ 3 ]`.

4. **Sanity Verification:**

- If entered value $\le 10$, bypasses dialogs.
- If value $> 10$, an instant modal appears: _"Confirm {N} launches for Body #{body_num}?"_ requiring a single tap or `Enter` to approve.

5. **Execution & Submission:**

- Pressing `Enter` triggers submission.
- UI debounces further submissions for **1,500ms** to prevent accidental double-taps.
- The entry is prepended to the top of the **"Latest 50 Dispatches"** table on screen.
- Inputs clear automatically and focus returns to `input[name="body_number"]` within **100ms**.

---

### 2.2 Controller 2-Minute Undo Workflow

- **Context:** A controller accidentally types Body #12 instead of Body #112 and hits Enter during rush hour.

```text
[ Controller clicks "Undo" on row in Recent 50 list ]
                         │
                         ▼
      [ System checks: (NOW() - logged_at) <= 120s ]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
   [ YES: Within Window ]           [ NO: > 120s Passed ]
        │                                 │
        ▼                                 ▼
[ Prompt for Void Reason ]          [ Reject Action ]
(e.g., "Typo in Body Number")       "Undo window expired.
        │                            Contact TODA Official."
        ▼
[ Execute Soft-Void via RLS ]
- SET is_voided = TRUE
- SET voided_at = NOW()
- SET voided_by = auth.uid()
- SET void_reason = 'Typo'
        │
        ▼
[ Row struck through in Recent Feed ]

```

---

## Part 3: The Officials & Audit Board (Oversight & Daily Reconciliation)

Officials operate strictly in an analytical and oversight capacity. Their dashboards are read-only for daily tallies, with controlled 36-hour adjustment capabilities.

```
       [ Official Opens Daily Audit Dashboard ]
                           │
                           ▼
          [ Select Date (Default: Today, GMT+8) ]
                           │
                           ▼
    [ Database Executes Aggregated Single-Roundtrip Join ]
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
[ Live Metric Cards ] [ Hourly Histogram ] [ Controller Performance ]
- Total Launches      - Bar chart: 06:00    - Launches per controller
- Active Drivers        to 21:00 volume     - Void count / Void rate
- Total Adjustments   - Peak rush hour
         │
         ▼
[ Detailed Transaction Ledger ]
(Filterable by Body #, Controller, Void status)
         │
         ▼
[ End-of-Day Physical Cash Reconciliation ]
- Official counts physical collection envelopes
- Compares against: Total Non-Void Launches * Standard Unit Fee
         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
  [ Totals Match ]               [ Discrepancy Found ]
         │                               │
         ▼                               ▼
[ Close Day: Reconciled ]    [ 36-Hour Adjustment Protocol ]
                             - Official appends audit notation
                             - Flags specific disputed launch IDs
                             - System logs `audited_by` & timestamp

```

### 3.1 Daily Metrics Aggregation

The dashboard queries the database using timezone-bounded windows (`Asia/Manila` / UTC+8: `00:00:00` to `23:59:59`):

- **Total Daily Units:** $\sum (\text{launch\_count})$ where `is_voided = FALSE`.
- **Void Ratio:** $\frac{\text{Total Voids}}{\text{Total Records Logged}} \times 100\%$ (flags controllers with abnormally high error/void rates).
- **Rush Hour Distribution:** Bucketed hourly counts ($6\text{ AM}, 7\text{ AM}, \dots, 9\text{ PM}$) illustrating terminal congestion patterns for local traffic planning.

---

### 3.2 The 36-Hour Auditor Adjustment Window

- **Context:** At 9:00 PM during cash collection, the physical envelope from Controller A has cash for 450 launches, but the system logs indicate 452 launches.
- **Audit Flow:**

1. The Auditor checks Controller A's line-by-line log.
2. If an un-voided erroneous launch is identified, the Auditor submits an **Audit Adjustment**.
3. **Time-Lock Rule:** The adjustment must occur within **36 hours** of that day's midnight boundary.
4. **Audit Immutability:** The original record is never deleted. An adjustment record is inserted into `audit_adjustments`:

```sql
INSERT INTO audit_adjustments (
    dispatch_id,
    official_id,
    adjustment_type,
    notes,
    created_at
) VALUES (
    10482,
    auth.uid(),
    'manual_credit_void',
    'Driver double-logged at 14:02; cash not collected',
    NOW()
);

```

5. After 36 hours, all entries for that date are permanently locked at the database level against all modifications.

---

### 3.3 Access Control & Governance (ABAC / Capability Matrix)

| Operational Capability                              | Controller | Auditor / Official | Secretary / Chairman |
| --------------------------------------------------- | ---------- | ------------------ | -------------------- |
| **Lookup Driver Summary (Body #, Photo, Status)**   | Yes        | Yes                | Yes                  |
| **Append Dispatch Log (`INSERT`)**                  | Yes        | No                 | No                   |
| **Undo Self-Dispatch ($\le 2\text{ minutes}$)**     | Yes        | No                 | No                   |
| **View Live Aggregate Metrics & Graphs**            | No         | Yes (Read-Only)    | Yes                  |
| **Export Daily Audit Ledger (CSV/PDF)**             | No         | Yes                | Yes                  |
| **Append Audit Adjustment ($\le 36\text{ hours}$)** | No         | Yes                | Yes                  |
| **Register / Edit Driver Profile (SCD-2)**          | No         | No                 | Yes                  |
| **Suspend / Activate Driver**                       | No         | No                 | Yes                  |
| **Adjust System Settings & Grace Windows**          | No         | No                 | Yes (Chairman Only)  |
