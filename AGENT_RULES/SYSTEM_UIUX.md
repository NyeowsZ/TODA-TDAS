# DESIGN_SYSTEM.md: TODA Management & Information System

> **Purpose**: Single source of truth for frontend styling, component architecture, and UI generation (Tailwind CSS, shadcn/ui, Next.js).
> **Form Factor**: Responsive & Hybrid (Mobile/Tablet-First for Controller PWA; Desktop/Tablet-Optimized for Official Audit Dashboard).
> **Aesthetic Archetype**: Modern Rounded Minimalist / High-Legibility Transit & Fleet Utility.

---

## 1. System Philosophy & Anti-Patterns

### Core Principles

1. **Calm, Controlled Color Palette (Strict 60-30-10 Rule)**: Restrict color dispersion. Accent color is singular, deliberate, and purposeful. Semantic states (green, amber, red) are reserved strictly for operational status flags, alerts, and confirmations.

2. **Hyper-Rounded Geometry**: Soft, friendly, and non-fatiguing geometry using smooth container radii (`rounded-2xl` to `rounded-3xl`) and pill elements (`rounded-full`). Sharp rectangular cut-outs ($< 12\text{px}$) are forbidden.

3. **High-Velocity Scannability**: Controller booth operations require 1.5-second visual comprehension. Critical data (Body Number, Driver Name, Launch Multiplier, Active/Suspended status) must dominate visual hierarchy with high contrast.

4. **Accessible, Finger-Friendly Hit Targets**: Minimum physical touch targets of $48\text{px} \times 48\text{px}$ for all terminal buttons to eliminate miss-clicks during rush hours.

### Explicit Anti-Patterns (Do NOT Generate)

- ❌ **No Rainbow/Cluttered Accents**: Do not mix purple, cyan, yellow, and blue CTAs on the same screen. Stick to one dedicated brand accent (`brand-primary`) alongside clean neutrals.

- ❌ **No Notched or Cut-Through Input Borders**: Do not place input field labels slicing through borders. Use clean vertical stacks (label placed cleanly above pill containers).

- ❌ **No Pure Black (`#000000`)**: Never use pitch black. Use deep structural slate (`#0F172A`) for high-contrast text and dark cards.

- ❌ **No Flat Hospital-White Canvases**: Avoid pure `#FFFFFF` background fills; canvas uses subtle off-white (`#F8FAFC`) to reduce glare under sunlight.

- ❌ **No Wireframe-Only Buttons**: Action items must use solid filled surfaces or soft tints (`bg-blue-50`), never thin wireframes.

- ❌ **No Emoji**: Emojis are not allowed in any part of the UI.

---

## 2. Color Tokens (Strict 60-30-10 Distribution)

### 60% — Canvas & Base Surfaces (Dominant Neutral)

Sets a glare-free baseline for outdoor and indoor terminal operation.

| Token Name       | Hex Code  | Tailwind Equivalent | Role & Application            |
| ---------------- | --------- | ------------------- | ----------------------------- |
| `surface-canvas` | `#F8FAFC` | `bg-slate-50`       | Full-screen background canvas |

|
| `surface-card` | `#FFFFFF` | `bg-white` | Elevated floating cards, modal panels, sheets

|
| `surface-subtle` | `#F1F5F9` | `bg-slate-100` | Input fills, keypad pill backdrops, table alt rows

|
| `surface-inverse` | `#0F172A` | `bg-slate-900` | High-contrast hero metric card (Daily Launch Total)

|
| `surface-glass` | `rgba(255,255,255,0.90)` | `bg-white/90 backdrop-blur-md` | Floating bottom navigation docks, fixed headers

|

### 30% — Structure, Layout & Content (Secondary Neutral)

Provides legibility, hierarchy, and structural grounding without adding visual noise.

| Token Name     | Hex Code  | Tailwind Equivalent | Role & Application                     |
| -------------- | --------- | ------------------- | -------------------------------------- |
| `text-primary` | `#0F172A` | `text-slate-900`    | Body numbers, headings, primary values |

|
| `text-secondary` | `#475569` | `text-slate-600` | Driver full names, field labels, metadata

|
| `text-muted` | `#94A3B8` | `text-slate-400` | Timestamps, secondary IDs, placeholders

|
| `border-subtle` | `#E2E8F0` | `border-slate-200` | Soft dividers, card perimeter rings

|
| `border-focus` | `#2563EB` | `ring-blue-600` | Input focus rings

|

### 10% — Accent & Semantic Flags (Single Accent + Purposeful Flags)

One core blue accent for actions, accompanied strictly by standard operational flags (Success, Warning, Destructive).

| Token Name      | Hex Code  | Tailwind Equivalent | Role & Application                              |
| --------------- | --------- | ------------------- | ----------------------------------------------- |
| `brand-primary` | `#2563EB` | `bg-blue-600`       | Primary CTA, launch confirm button, active tabs |

|
| `brand-hover` | `#1D4ED8` | `bg-blue-700` | Active tap and hover state

|
| `brand-soft` | `#EFF6FF` | `bg-blue-50` | Preset multiplier chips (`[1x]`, `[2x]`), icon badges

|
| `brand-soft-text` | `#1D4ED8` | `text-blue-700` | Text/label on `brand-soft` chips

|
| `status-success-bg` | `#DCFCE7` | `bg-emerald-100` | "Active" driver badge, balanced cash indicator

|
| `status-success-text` | `#15803D` | `text-emerald-700` | Text on active badge, successful entry toast

|
| `status-warning-bg` | `#FEF3C7` | `bg-amber-100` | Sanity check alert ($>10\text{x}$ launches), pending reconciliation

|
| `status-warning-text` | `#B45309` | `text-amber-700` | Text on warnings

|
| `status-danger-bg` | `#FEE2E2` | `bg-rose-100` | "Suspended" driver banner, voided log strikethrough |
| `status-danger-text` | `#B91C1C` | `text-rose-700` | Text for suspended statuses, void countdown alert |
| `status-danger-solid` | `#EF4444` | `bg-rose-500` | Destructive CTA (e.g., "Confirm Void")

|

---

## 3. Shape & Elevation Scale

### Border Radius Hierarchy

```
[ Component ]                         [ Radius ]       [ Tailwind Class ]
Multiplier Chips & Badges ----------> 9999px --------> rounded-full[cite: 1]
Action Buttons & Undo Triggers -----> 9999px --------> rounded-full[cite: 1]
Summary Header / Metric Hero Card --> 28px ----------> rounded-3xl[cite: 1]
Driver Match Preview Cards ---------> 20px ----------> rounded-2xl[cite: 1]
Input Fields & Search Bars ---------> 16px ----------> rounded-2xl[cite: 1]
Table Containers & Modals ----------> 24px ----------> rounded-3xl

```

### Elevation & Depth Levels

- **Level 0 (Flat)**: `border border-slate-200/60` (Used inside list items or nested summaries).

- **Level 1 (Card Rest)**: `shadow-sm shadow-slate-200/50 border border-slate-100` (Driver match card, table surface).

- **Level 2 (Interactive Floating)**: `shadow-lg shadow-blue-500/20` (Launch submit button).

- **Level 3 (Modal / Overlays)**: `shadow-xl shadow-slate-300/40 border border-white/60` (Sanity confirmation prompt, undo modal).

---

## 4. Typography Matrix

- **Primary Font Stack**: `Plus Jakarta Sans`, `Inter`, system-ui.

- **Monospace Stack**: `JetBrains Mono`, `SF Mono` (for Body Numbers, Timestamps, and Audit IDs).

| Tier        | Size          | Line Height   | Weight          | Tracking  | Usage                                    |
| ----------- | ------------- | ------------- | --------------- | --------- | ---------------------------------------- |
| **Display** | $32\text{px}$ | $38\text{px}$ | 800 (ExtraBold) | `-0.02em` | Daily total slots, total active vehicles |

|
| **H1** | $24\text{px}$ | $30\text{px}$ | 700 (Bold) | `-0.01em` | Controller terminal header, screen titles

|
| **H2** | $18\text{px}$ | $24\text{px}$ | 700 (Bold) | `normal` | Matched driver name, section titles

|
| **Body Bold** | $15\text{px}$ | $22\text{px}$ | 600 (SemiBold) | `normal` | Multiplier chips, button labels

|
| **Body** | $14\text{px}$ | $20\text{px}$ | 500 (Medium) | `normal` | Inputs, table cells, operational summaries

|
| **Label** | $12\text{px}$ | $16\text{px}$ | 600 (SemiBold) | `+0.02em` | Uppercase micro-labels ("BODY NUMBER")

|
| **Caption** | $11\text{px}$ | $14\text{px}$ | 500 (Medium) | `normal` | Timestamps (GMT+8), version numbers

|

---

## 5. Blueprint Components

### 5.1. Controller Fast-Entry Search Input

```html
<div class="space-y-1.5 w-full">
  <label
    class="text-[12px] font-semibold text-slate-500 uppercase tracking-wider pl-3"
  >
    Body Number
  </label>
  <div
    class="flex items-center bg-slate-100 rounded-2xl px-4 py-3.5 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:shadow-sm"
  >
    <input
      type="text"
      inputmode="numeric"
      placeholder="e.g. 042"
      class="w-full bg-transparent text-base font-bold font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none"
      autofocus
    />
  </div>
</div>
```

### 5.2. Instant Driver Match Card (Active vs Suspended)

```html
<!-- State A: Active Driver Match -->
<div
  class="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-100 shadow-sm"
>
  <div class="flex items-center gap-3.5">
    <img
      src="/avatar.webp"
      alt="Driver"
      class="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100"
    />
    <div>
      <div class="flex items-center gap-2">
        <span
          class="font-mono text-xs font-extrabold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md"
        >
          #042
        </span>
        <h3 class="text-sm font-bold text-slate-900">Rodrigo Mendoza</h3>
      </div>
      <p class="text-xs font-medium text-slate-400 mt-0.5">
        Tricycle Unit: Plate 884-XY
      </p>
    </div>
  </div>
  <span
    class="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full"
  >
    Active
  </span>
</div>

<!-- State B: Suspended Driver Flag (Alert) -->
<div
  class="bg-rose-50 rounded-2xl p-4 flex items-center justify-between border border-rose-200"
>
  <div class="flex items-center gap-3.5">
    <div
      class="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold"
    >
      !
    </div>
    <div>
      <div class="flex items-center gap-2">
        <span
          class="font-mono text-xs font-extrabold px-2 py-0.5 bg-rose-200 text-rose-800 rounded-md"
        >
          #118
        </span>
        <h3 class="text-sm font-bold text-rose-950">Danilo Ramos</h3>
      </div>
      <p class="text-xs font-medium text-rose-600 mt-0.5">
        Suspended: Terminal route violation
      </p>
    </div>
  </div>
  <span
    class="px-3 py-1 bg-rose-200 text-rose-800 text-xs font-bold rounded-full"
  >
    Suspended
  </span>
</div>
```

### 5.3. Multiplier Selector Chips & Primary Submit Button

```html
<!-- Fast Chips -->
<div class="flex gap-2">
  <button
    class="flex-1 h-12 bg-blue-600 text-white font-bold text-sm rounded-full shadow-sm"
  >
    1 Launch
  </button>
  <button
    class="flex-1 h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-sm rounded-full transition-all"
  >
    2 Launches
  </button>
  <button
    class="flex-1 h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-sm rounded-full transition-all"
  >
    3 Launches
  </button>
</div>

<!-- Submit Action -->
<button
  class="w-full h-14 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-base font-bold rounded-full shadow-lg shadow-blue-600/25 flex items-center justify-center transition-all"
>
  <span>Log Dispatch (Enter)</span>
</button>
```

### 5.4. Recent 50 Feed Row with 2-Minute Undo Countdown

```html
<div
  class="bg-white rounded-2xl p-3.5 flex items-center justify-between border border-slate-100 shadow-sm"
>
  <div class="flex items-center gap-3">
    <span
      class="font-mono text-xs font-extrabold px-2 py-1 bg-slate-100 text-slate-800 rounded-lg"
    >
      #042
    </span>
    <div>
      <p class="text-xs font-bold text-slate-900">1x Launch logged</p>
      <p class="text-[11px] text-slate-400 font-mono">17:42:09 · PST</p>
    </div>
  </div>

  <!-- Active Grace Countdown Trigger -->
  <button
    class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all"
  >
    <span>Undo</span>
    <span
      class="font-mono text-[10px] bg-rose-200/60 px-1.5 py-0.5 rounded-full"
      >1:42</span
    >
  </button>
</div>
```

### 5.5. Official Audit Hero Card (Daily Aggregation)

```html
<div
  class="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/10"
>
  <div class="flex justify-between items-start mb-6">
    <div>
      <span
        class="text-xs font-semibold uppercase tracking-wider text-slate-400"
        >Total Dispatches Today</span
      >
      <div class="flex items-baseline gap-2 mt-1">
        <span class="text-4xl font-extrabold tracking-tight font-mono"
          >1,842</span
        >
        <span class="text-emerald-400 font-medium text-xs">● Active Shift</span>
      </div>
    </div>
    <span
      class="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-mono font-medium rounded-full border border-slate-700"
    >
      GMT+8
    </span>
  </div>

  <div class="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800">
    <div>
      <p class="text-[10px] text-slate-400 uppercase font-semibold">
        Active Units
      </p>
      <p class="text-base font-bold font-mono text-slate-100 mt-0.5">246</p>
    </div>
    <div>
      <p class="text-[10px] text-slate-400 uppercase font-semibold">
        Voided Slots
      </p>
      <p class="text-base font-bold font-mono text-rose-400 mt-0.5">6 (0.3%)</p>
    </div>
    <div>
      <p class="text-[10px] text-slate-400 uppercase font-semibold">
        Peak Rush Hour
      </p>
      <p class="text-base font-bold font-mono text-slate-100 mt-0.5">
        07:00 - 08:00
      </p>
    </div>
  </div>
</div>
```

---

## 6. AI Agent Prompt Directives

Paste this block into prompts when asking AI coding agents to generate or refactor UI screens for this system:

```text
Follow the TODA Modern Rounded Design System at DESIGN_SYSTEM.md:
1. Corner radii must be hyper-rounded: action buttons, chips, and badges use `rounded-full`, inputs `rounded-2xl`, cards `rounded-2xl`, and metric hero cards `rounded-3xl`.
2. Adhere strictly to the 60-30-10 color rule:
   - 60% Canvas/Cards: #F8FAFC canvas, #FFFFFF cards.
   - 30% Structural Neutrals: #0F172A text, #F1F5F9 input fills, #E2E8F0 borders.
   - 10% Accent & Status: One core blue accent (#2563EB) for primary actions and active selections.
3. Reserve semantic colors exclusively for operational alerts:
   - Green (#DCFCE7 / #15803D) strictly for "Active" status and success feedback.
   - Amber (#FEF3C7 / #B45309) strictly for sanity checks (>10 launches) and pending reconciliations.
   - Red (#FEE2E2 / #B91C1C) strictly for "Suspended" drivers, error barriers, and the 2-minute undo trigger.
4. Input fields must be clean vertical stacks (label positioned above a soft rounded-2xl fill container), never split or notched wireframe borders.
5. All interactive buttons on controller terminals must maintain a minimum 48px touch target.

```
