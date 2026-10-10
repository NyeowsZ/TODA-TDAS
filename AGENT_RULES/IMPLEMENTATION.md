# IMPLEMENTATION.md — Controller Terminal Production Master Plan

> **Purpose**: Technical specification and phased rollout plan for porting the user-approved 3-card vertical stack dispatch terminal from `DONOTPUSH/samples/sample-refined.html` into the Next.js production app (`toda-app`).
>
> **Status**: Approved & Ready for Implementation  
> **Source Prototypes**: `DONOTPUSH/samples/sample-refined.html` & `sample-1-wireframe-faithful.html`  
> **Target Branch**: `feature/controller-terminal-refactor` (to be PR'd to `dev`)

---

## 1. Architectural Blueprint & Layout System

### 1.1. Viewport & Canvas Geometry
- **Strict `100dvh` Viewport Lock**: The entire terminal is wrapped in `h-screen max-h-[100dvh] overflow-hidden`.
- **Zero Window Scroll**: Neither the window nor the main page container scrolls. All overflow is handled within discrete internal containers.
- **2-Column Responsive Split**:
  - **Left Column (`w-full lg:w-7/12 xl:w-3/5`)**: Physical Clipboard Live Stack Ledger (`live-stack-feed.tsx`).
  - **Right Column (`w-full lg:w-5/12 xl:w-2/5`)**: 3-Card Vertical Interaction Stack.

---

## 2. Right Column: 3-Card Vertical Stack

```
┌──────────────────────────────────────────────────────────┐
│ CARD 1: OMNIBOX SEARCH (Fixed 3-Row Stock List)          │
│ • Input: Body # or Driver Name (Auto-focused, '/' hotkey)│
│ • Fixed list: h-[120px] scrollable, full column headers  │
│ • Subdued highlight for non-focused rows                 │
│ • Empty <Enter> Guard: Shake animation, prevents advance │
└────────────────────────────┬─────────────────────────────┘
                             │ <Enter> on Active Driver
                             ▼
┌──────────────────────────────────────────────────────────┐
│ CARD 2: DEDICATED ROUTE SELECTOR                         │
│ • Horizontal Route Buttons: Guinsay, Taytay, Sabang...   │
│ • Last-Used Memory: Remembers & focuses last-used route  │
│ • Keyboard: ← and → arrows cycle routes seamlessly       │
│ • <Enter> confirms route and advances to Card 3          │
│ • <Escape> returns focus to Omnibox                      │
└────────────────────────────┬─────────────────────────────┘
                             │ <Enter> on Route Button
                             ▼
┌──────────────────────────────────────────────────────────┐
│ CARD 3: DRIVER INFO + LAUNCH AMOUNT                      │
│ • 80x80 Photo Thumbnail, Body #, Nickname, Name, Row/Trips│
│ • DYNAMIC FULL-CARD ALERT LIGHT-UP:                     │
│   - SUSPENDED: Card turns RED (bg-rose-50, border-rose-500)│
│     Badge: ⛔ SUSPENDED; Hard Lockout: Enter is BLOCKED   │
│   - INACTIVE: Card turns AMBER (bg-amber-50, amber-500)  │
│     Badge: ⚠️ INACTIVE; Hard Lockout: Enter is BLOCKED    │
│   - ACTIVE: Clean calm slate; NO redundant "Active" badge │
│ • Field Label: "Launch Amount" (Clean standard)          │
│ • Input: Value 1 highlighted (<amountInput.select()>)    │
│ • 500ms Anti-Spam Lock with "Logged" indicator           │
│ • <Enter> executes dispatch, loops focus back to Omnibox │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Left Column: Physical Clipboard Ledger & Sheet Pagination

### 3.1. 30 / 50 Sheet Pagination Pill
- **Philippine TODA Tally Sheet Parity**: Real dispatch tally clipboards use standard sheets of 30 or 50 rows.
- **Controls**:
  - Sheet Page Size Selector: `[ 30 | 50 ]` toggle buttons.
  - Sheet Navigator: `[ ‹ ] [ Sheet 1 (1–30) ] [ › ]`.
  - Dynamically calculates total sheets based on total dispatches for the day.
  - Slices records precisely per sheet range (`startIndex` to `startIndex + pageSize`).

### 3.2. Sequential Append-Only Records
- **Distinct Rows (Never Collapsed)**: Consecutive dispatches for the same driver (e.g. `#550 x10`, then `#550 x1`) remain completely separate rows with unique IDs and line numbers.
- **Clean Neutral Slate Badges**: Zero yellow or amber styling on launch multipliers. Clean `bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-xs` badges.
- **Route Column**: Displays the selected route badge (`Guinsay`, `Taytay`, `Sabang`).
- **2-Minute Soft-Undo Action**: Preserves audit integrity with confirmation dialog.

---

## 4. Keyboard State Machine & Event Lifecycle

| Step | Active Element | Key Pressed | Target / Action | Edge Case / Protection |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Omnibox Input | <kbd>Enter</kbd> | If active driver matched: Advance to Route | Empty query: Shake animation, no advance |
| **1** | Omnibox Input | <kbd>Enter</kbd> | If driver is **Suspended / Inactive** | **STRICT BLOCK**: Shake card & Omnibox, show toast, DO NOT advance |
| **1** | Omnibox Input | <kbd>↓</kbd> / <kbd>↑</kbd> | Navigate dropdown results | Updates driver preview card live |
| **2** | Route Button | <kbd>→</kbd> | Cycle to next route (+1 step) | Unidirectional right navigation (`Guinsay` → `Taytay` → `Sabang`) |
| **2** | Route Button | <kbd>←</kbd> | Cycle to previous route (-1 step) | Unidirectional left navigation (`Sabang` → `Taytay` → `Guinsay`) |
| **2** | Route Button | <kbd>Enter</kbd> | Confirm route → Advance to Amount Input | Armed only after Omnibox <kbd>Enter</kbd> released (`keyup` + 80ms) |
| **2** | Route Button | <kbd>Escape</kbd> | Return focus to Omnibox | `omniboxInput.focus(); omniboxInput.select();` |
| **3** | Amount Input | <kbd>Enter</kbd> | Submit dispatch | Armed on `keyup`, 500ms anti-spam lock, resets focus to Omnibox |
| **3** | Amount Input | <kbd>Escape</kbd> | Return focus to Route Button | `routeButtons[selectedRouteIndex].focus();` |
| **Any** | Anywhere | <kbd>/</kbd> or <kbd>Ctrl+K</kbd> | Immediate focus jump to Omnibox | Global shortcut |

---

## 5. Domain Invariant Compliance

1. **Strict Invariant: Inactive/Suspended Rejection**:
   - `drivers.status IN ('suspended', 'inactive')` CANNOT be dispatched.
   - The UI provides immediate, unmissable visual feedback (entire card lights up red/amber).
   - <kbd>Enter</kbd> and mouse click transitions are hard-intercepted and rejected.
   - Server actions reinforce this invariant at the database/API boundary.
2. **Server-Authoritative Timestamps**:
   - `logged_at` generated via PostgreSQL `NOW()` / UTC, displayed in GMT+8 (`Asia/Manila`).
3. **Append-Only History**:
   - All dispatches insert immutable rows into `dispatch_logs`.
   - Undos update `is_voided = TRUE` within the 2-minute grace window.
4. **Sub-2-Second Dispatch Loop**:
   - Driver lookup performed in memory via `useDriverCache` hook (<5ms lookup).

---

## 6. Target Production Components (`toda-app`)

### Component Breakdown
1. **`toda-app/components/controller/controller-terminal.tsx`**:
   - Master layout orchestrator holding shared terminal state:
     - `selectedDriver`, `selectedRoute`, `lastUsedRouteId`, `sheetPageSize` (30/50), `currentSheet`.
     - Mounts 2-column layout with `100dvh` lock.
2. **`toda-app/components/controller/omnibox-search.tsx`**:
   - Card 1: Fixed 3-row stock table (`h-[120px]`), full readable table headers.
   - Empty guard validation.
   - Suspended/inactive validation guard before emitting onSelect.
3. **`toda-app/components/controller/route-selector.tsx`**:
   - Card 2: Standalone route buttons grid.
   - Roving focus management, <kbd>←</kbd> and <kbd>→</kbd> arrow key navigation.
   - Enter arming debounce to prevent bleed-through from Omnibox.
4. **`toda-app/components/controller/driver-info-panel.tsx`**:
   - Card 3: 80x80 photo thumbnail, body #, name, row, trips.
   - Dynamic alert styling (Red `bg-rose-50 border-rose-500` for Suspended, Amber `bg-amber-50 border-amber-500` for Inactive).
   - Amount input with `select()` on focus.
   - 500ms anti-spam dispatch button with "Logged" indicator.
5. **`toda-app/components/controller/live-stack-feed.tsx`**:
   - Left column ledger:
     - Sheet pagination pill with 30/50 page size selector and sheet navigation.
     - Sequential unmerged rows with neutral slate badges.
     - Route column.
6. **`toda-app/components/controller/route-manager-modal.tsx`**:
   - Admin modal allowing Chairman/Secretary to add, rename, and toggle active routes (`Guinsay`, `Taytay`, `Sabang`).

---

## 7. Step-by-Step Implementation Checklist & Microcommits Log

- [x] **Step 1: Git Branch Setup**: Created and switched to `feature/controller-terminal-refactor` from `dev` (`7ee8938`).
- [x] **Step 2: Routes State & Database Schema**: Updated `validators.ts`, `dispatch-actions.ts`, `schema.sql`, and `types/supabase.ts` with resilient `route` parameter support.
  - Commit: `0cb9c21` (`feat(actions): support route parameter in logDispatch action and validation schema`)
- [x] **Step 3: Build Route Selector Component (`route-selector.tsx`)**:
  - Horizontal buttons grid with last-used route memory (`localStorage` key `dacotoda_last_route`).
  - True unidirectional <kbd>←</kbd> and <kbd>→</kbd> arrow key navigation.
  - Synthetic click suppression (`e.detail === 0`) and Enter keyup arming buffer.
  - Admin CRUD modal for routes.
  - Commit: `9935a20` (`feat(controller): add RouteSelector component with keyboard navigation and persistence`)
- [x] **Step 4: Refactor Omnibox Search (`omnibox-search.tsx`)**:
  - Fixed 3-row stock table (`h-[120px]`).
  - Readable table headers: `Body No.`, `Last Name`, `First Name`, `M.I.`, `Nickname`.
  - Empty <kbd>Enter</kbd> validation guard with pulse-shake animation.
  - Inactive / Suspended hard lockout: shake animation + alert notification, prevents advance.
  - Added `.shake` utility to `globals.css`.
  - Commit: `004107c` (`feat(controller): update OmniboxSearch with fixed 3-row stock table and invariant lockout`)
- [x] **Step 5: Build Driver Info & Launch Amount (`driver-info-panel.tsx`)**:
  - Full-card dynamic light-up: vibrant red for Suspended (`⛔ SUSPENDED`), bright amber for Inactive (`⚠️ INACTIVE`), clean slate with zero redundant badge for Active.
  - Standard clean label "Launch Amount" with auto-selected `1` on focus (`amountInput.select()`).
  - 500ms anti-spam lock with subtle "Logged" indicator.
  - Commit: `a053bc6` (`feat(controller): add DriverInfoPanel with dynamic alert illumination and launch amount`)
- [x] **Step 6: Refactor Live Stack Feed (`live-stack-feed.tsx`)**:
  - 30 / 50 sheet pagination pill (`[ 30 | 50 ]` and `‹ Sheet X (1–30) ›`).
  - Distinct unmerged sequential rows with unique line numbers.
  - Route column badge.
  - Clean neutral slate launch multiplier badges (zero yellowing).
  - Commit: `7388352` (`feat(controller): update LiveStackFeed with 30/50 sheet pagination and neutral badges`)
- [x] **Step 7: Wire Terminal Master Shell (`controller-terminal.tsx`)**:
  - Strict `100dvh` viewport layout (`h-screen max-h-[100dvh] overflow-hidden`).
  - Seamless keyboard focus cycle: Omnibox -> Route -> Amount -> Omnibox.
  - Live Manila clock (`HH:mm:ss GMT+8`), driver cache indicator, and 2-minute soft-undo integration.
  - Commit: `afd4991` (`feat(controller): assemble 3-card vertical terminal with strict 100dvh layout`)
- [x] **Step 8: TypeScript & Production Build Verification**:
  - `npx tsc --noEmit` verified with 0 errors.
  - `npm run build` compiled 100% of routes cleanly into production bundle.
- [x] **Step 9: Remote Push**:
  - All 6 microcommits pushed to `origin feature/controller-terminal-refactor`.
  - Ready for user Pull Request into `dev`.
