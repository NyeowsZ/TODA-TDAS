# SYSTEM_ARCHITECTURE.md: TODA Management & Information System

This document specifies the technical architecture, deployment topology, database security boundaries, state management strategies, and directory structure for the TODA Management and Information System.

---

## 1. Architectural Overview & System Topology

The system uses a **BFF (Backend-for-Frontend)** decoupled architecture hosted across two serverless infrastructures:

- **Presentation & Edge Layer:** Next.js (App Router) deployed on **Vercel**.
- **Data, Auth, Storage & Realtime Layer:** PostgreSQL deployed on **Supabase** (Pro Tier).

```
                      ┌───────────────────────────────────────────────┐
                      │              CLIENT HARDWARE                  │
                      │  • Controller: Mobile/Tablet + NumPad (PWA)   │
                      │  • Official: Desktop/Tablet Dashboard         │
                      └──────────────────────┬────────────────────────┘
                                             │ HTTPS / WSS
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │                 VERCEL EDGE                   │
                      │  Next.js Middleware (Session Validation &     │
                      │  Role Route Enforcement via httpOnly Cookies) │
                      └───────┬───────────────────────────────┬───────┘
                              │                               │
                Server Components & Actions        Direct Browser Query
               (Admin, Mutations, Auth)           (Cached Lookups, Realtime)
                              │                               │
                              ▼                               ▼
                      ┌───────────────────────────────────────────────┐
                      │                SUPABASE CLOUD                 │
                      │                                               │
                      │  ┌─────────────────────────────────────────┐  │
                      │  │ GoTrue (Auth) - httpOnly JWT Sessions   │  │
                      │  └─────────────────────────────────────────┘  │
                      │  ┌─────────────────────────────────────────┐  │
                      │  │ PostgREST API (Direct RLS-Enforced CRUD)│  │
                      │  └─────────────────────────────────────────┘  │
                      │  ┌─────────────────────────────────────────┐  │
                      │  │ Realtime Engine (WebSocket Invalidation)│  │
                      │  └─────────────────────────────────────────┘  │
                      │  ┌─────────────────────────────────────────┐  │
                      │  │ Storage Buckets (WebP Avatar/Unit CDN)  │  │
                      │  └─────────────────────────────────────────┘  │
                      │  ┌─────────────────────────────────────────┐  │
                      │  │ PostgreSQL Engine                       │  │
                      │  │ • Row Level Security (POLP / ABAC)      │  │
                      │  │ • Immutable Append-Only Ledger          │  │
                      │  │ • Deterministic GMT+8 Materialized Views│  │
                      │  └─────────────────────────────────────────┘  │
                      └───────────────────────────────────────────────┘

```

---

## 2. Technical Stack Specifications

| Layer                    | Technology                             | Primary Function                                                                           |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Framework**            | **Next.js (App Router)**               | Full-stack framework; Server Components for analytics, Client Components for terminal I/O. |
| **Hosting & CI/CD**      | **Vercel**                             | Git-triggered serverless deployments, automatic SSL, edge route caching.                   |
| **Database**             | **PostgreSQL (Supabase)**              | Relational engine; ACID transactions, RLS enforcement, versioning anchors.                 |
| **Auth System**          | **Supabase Auth (`@supabase/ssr`)**    | Role-based JWT session handling persisted in secure `httpOnly` cookies.                    |
| **Client State / Cache** | **TanStack React Query**               | In-memory caching for driver rosters, optimistic dispatch feed handling.                   |
| **UI & Styling**         | **Tailwind CSS + shadcn/ui**           | High-contrast, keyboard-first, low-footprint touch targets.                                |
| **Asset Storage**        | **Supabase Storage**                   | Public/Authenticated CDN buckets for compressed driver and tricycle images.                |
| **Type Safety**          | **Supabase CLI (`types/supabase.ts`)** | Auto-generated TypeScript definitions synchronizing PostgreSQL schemas with Next.js.       |

---

## 3. Data & State Management Strategy

### 3.1 Terminal Roster In-Memory Cache (Sub-2s Lookup)

Because the controller processes up to 2,500 entries daily under unpredictable cell tower reception:

1. **Initial Hydration:** When the controller logs in, the browser queries the lightweight summary view:

```sql
SELECT id, body_number, full_name, driver_photo_url, status
FROM view_driver_active_summaries;

```

2. **Memory Map:** The data is stored in memory as an indexed `Map<string, DriverSummary>` keyed by `body_number`.
3. **Lookup Latency:** Typing a body number yields a visual card match in $\le 5\text{ms}$ without making an HTTP request.
4. **Invalidation:** A Supabase Realtime channel listens for changes on `drivers`. If an official registers or suspends a driver, the local map updates in the background.

### 3.2 Bounded Controller Feed

The controller view renders an optimistic feed capped at **50 items**:

- Submissions append immediately to client memory.
- An active countdown timer renders for entries younger than 120 seconds.
- Items older than 50 entries are shifted out of DOM memory to prevent mobile browser memory bloat.

---

## 4. Database Schema & Security Blueprint (RLS & Functions)

```
                            ┌───────────────────┐
                            │    auth.users     │
                            └─────────┬─────────┘
                                      │ 1:1
                                      ▼
                            ┌───────────────────┐
                            │   user_profiles   │
                            │   (role, status)  │
                            └─────────┬─────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │ 1:N (registered_by)     │ 1:N (controller_id)     │ 1:N (official_id)
            ▼                         ▼                         ▼
  ┌──────────────────┐      ┌──────────────────┐      ┌────────────────────┐
  │     drivers      │      │  dispatch_logs   │◄─────┤ audit_adjustments  │
  │ (anchor identity)│      │  (append-only)   │ 1:N  │ (36-hr adjustments)│
  └─────────┬────────┘      └──────────────────┘      └────────────────────┘
            │ 1:N
            ▼
  ┌─────────────────────────┐
  │ driver_profile_versions │
  │   (immutable SCD-2)     │
  └─────────────────────────┘

```

### 4.1 SQL Schema Definition

```sql
-- Dynamic System Configuration
CREATE TABLE public.system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.system_settings (key, value) VALUES
('sanity_multiplier_threshold', '{"threshold": 10}'),
('controller_undo_window_minutes', '{"minutes": 2}'),
('auditor_revision_window_hours', '{"hours": 36}');

-- User Roles for ABAC/RBAC
CREATE TYPE app_role AS ENUM ('controller', 'official', 'auditor', 'secretary', 'chairman');

CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role app_role NOT NULL DEFAULT 'controller',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core Driver Entity (Identity Anchor)
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    body_number VARCHAR(20) UNIQUE NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_drivers_body_num ON public.drivers(body_number);

-- Versioned Driver Profiles (SCD-2)
CREATE TABLE public.driver_profile_versions (
    id BIGSERIAL PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    version INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(30),
    driver_photo_url TEXT,
    unit_photo_url TEXT,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(driver_id, version)
);

-- Dispatch Ledger (Append-Only)
CREATE TABLE public.dispatch_logs (
    id BIGSERIAL PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    controller_id UUID NOT NULL REFERENCES auth.users(id),
    launch_count SMALLINT NOT NULL CHECK (launch_count > 0),
    logged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_voided BOOLEAN DEFAULT FALSE NOT NULL,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES auth.users(id),
    void_reason TEXT
);

CREATE INDEX idx_dispatch_controller_recent
ON public.dispatch_logs(controller_id, logged_at DESC);

CREATE INDEX idx_dispatch_audit_lookup
ON public.dispatch_logs(logged_at, is_voided);

-- Audit Adjustments Table (36-Hour Window Adjustments)
CREATE TABLE public.audit_adjustments (
    id BIGSERIAL PRIMARY KEY,
    dispatch_id BIGINT NOT NULL REFERENCES public.dispatch_logs(id),
    official_id UUID NOT NULL REFERENCES auth.users(id),
    adjustment_type VARCHAR(50) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

```

### 4.2 Helper Security Functions & RLS Policies

```sql
-- Helper: Get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS across all tables
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_adjustments ENABLE ROW LEVEL SECURITY;

-- 1. DRIVERS POLICIES
CREATE POLICY "Drivers readable by authenticated staff"
ON public.drivers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Drivers manageable only by board"
ON public.drivers FOR ALL
TO authenticated
USING (public.current_user_role() IN ('secretary', 'chairman'));

-- 2. DISPATCH LOGS POLICIES (POLP + Grace Window Enforced at DB Engine)
CREATE POLICY "Controllers can insert own dispatches"
ON public.dispatch_logs FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = controller_id
    AND public.current_user_role() = 'controller'
);

CREATE POLICY "Controllers can view own dispatches"
ON public.dispatch_logs FOR SELECT
TO authenticated
USING (
    (public.current_user_role() = 'controller' AND auth.uid() = controller_id)
    OR public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
);

-- Controller 2-Minute Undo Window RLS
CREATE POLICY "Controllers can undo within 2 minutes"
ON public.dispatch_logs FOR UPDATE
TO authenticated
USING (
    public.current_user_role() = 'controller'
    AND auth.uid() = controller_id
    AND is_voided = FALSE
    AND logged_at >= (NOW() - (
        SELECT (value->>'minutes')::INTEGER * INTERVAL '1 minute'
        FROM public.system_settings
        WHERE key = 'controller_undo_window_minutes'
    ))
)
WITH CHECK (
    is_voided = TRUE
    AND voided_by = auth.uid()
);

-- 3. AUDIT ADJUSTMENTS POLICIES (36-Hour Window Enforced)
CREATE POLICY "Auditors can insert adjustments within 36 hours"
ON public.audit_adjustments FOR INSERT
TO authenticated
WITH CHECK (
    public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
    AND EXISTS (
        SELECT 1 FROM public.dispatch_logs dl
        WHERE dl.id = dispatch_id
        AND dl.logged_at >= (NOW() - (
            SELECT (value->>'hours')::INTEGER * INTERVAL '1 hour'
            FROM public.system_settings
            WHERE key = 'auditor_revision_window_hours'
        ))
    )
);

CREATE POLICY "Audits readable by officials"
ON public.audit_adjustments FOR SELECT
TO authenticated
USING (public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman'));

```

---

## 5. Next.js Project Architecture & Directory Layout

The application adheres strictly to the Next.js App Router paradigm, cleanly separating Server Actions from Client Component interactions.

```text
toda-system/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Split credentials entry (Controller / Official)
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── controller/
│   │   │   ├── page.tsx              # Terminal dispatch entry client
│   │   │   └── loading.tsx
│   │   ├── official/
│   │   │   ├── audit/
│   │   │   │   └── page.tsx          # Daily audit ledger & date picker
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx          # Rush hour bar charts & aggregates
│   │   │   ├── drivers/
│   │   │   │   ├── page.tsx          # Member roster directory
│   │   │   │   └── [id]/page.tsx      # Version history (SCD-2 view)
│   │   │   └── settings/
│   │   │       └── page.tsx          # System settings & grace windows (Chairman)
│   │   └── layout.tsx                # Role-aware navigation layout
│   ├── api/
│   │   └── export/
│   │       └── route.ts              # CSV export engine for daily audits
│   ├── globals.css
│   └── layout.tsx                    # Root layout with font optimization
├── components/
│   ├── controller/
│   │   ├── dispatch-keypad.tsx       # Auto-focused, keyboard-first form
│   │   ├── driver-match-card.tsx     # Instant preview card (Active/Suspended)
│   │   ├── recent-feed.tsx           # Top 50 items with 2-min countdown
│   │   └── undo-confirm-modal.tsx    # Modal capturing void reason
│   ├── official/
│   │   ├── hourly-chart.tsx          # Minimal SVG/Canvas hourly histogram
│   │   ├── reconciliation-card.tsx   # Expected cash vs recorded slots
│   │   └── version-diff.tsx          # Compares driver profile revisions
│   └── ui/                           # Primitive shadcn/ui components
├── hooks/
│   ├── use-driver-cache.ts           # In-memory map and realtime subscriber
│   ├── use-grace-timer.ts            # Client-side 120s countdown hook
│   └── use-keyboard-nav.ts           # Global keydown listeners for quick entry
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Client Component browser client
│   │   ├── server.ts                 # Server Component / Action cookie client
│   │   └── middleware.ts             # Edge token refresher & session guard
│   ├── utils/
│   │   ├── compress-image.ts         # Client-side Canvas/WebP compressor (≤100KB)
│   │   ├── format-timezone.ts        # UTC to GMT+8 (Asia/Manila) formatter
│   │   └── validators.ts             # Zod schemas for dispatch & driver mutations
│   └── actions/
│       ├── dispatch-actions.ts       # Server Actions for voiding and logging
│       ├── driver-actions.ts         # Server Actions for versioned profile updates
│       └── settings-actions.ts       # System settings updates (Admin only)
├── types/
│   └── supabase.ts                   # CLI-generated database type definitions
├── middleware.ts                     # Root Next.js edge route protection
└── public/
    └── manifest.json                 # PWA configuration for terminal tablets

```

---

## 6. Authentication & Session Flow (`@supabase/ssr`)

1. **Authentication Mechanism:** Login uses email/password or unique controller PIN via Supabase Auth.
2. **Session Persistence:**

- Cookies are created as `httpOnly`, `Secure`, `SameSite=Lax`.
- JavaScript running in the browser cannot read raw token strings, blocking token theft from XSS.

3. **Route Protection Matrix (`middleware.ts`):**

```text
Incoming Request ──► Read httpOnly Cookies ──► Retrieve user_profiles.role
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 Path: /controller/*   Path: /official/*   Path: /official/settings
       │                   │                   │
 Role == 'controller'  Role in ['official',  Role in ['secretary',
       │               'auditor', 'board']         'chairman']
       │                   │                   │
  [ Allow Pass ]      [ Allow Pass ]      [ Allow Pass ]
       │                   │                   │
   Otherwise           Otherwise           Otherwise
       ▼                   ▼                   ▼
 Redirect /login     Redirect /login     Redirect /official/audit

```

---

## 7. Performance & High-Throughput Optimization

- **Zero Keystroke Network I/O:** Lookups happen locally against the in-memory array or Map. The network is only hit upon form submission.
- **Payload Compression:** Photos are converted to WebP on the client device before upload via `compress-image.ts`:

```ts
// Target: width/height max 800px, quality 0.75 -> Produces ~50KB to 90KB assets
```

- **Read-Only Dashboard Pagination:** Official tables querying `dispatch_logs` strictly slice by indexed timestamps (`WHERE logged_at >= day_start AND logged_at <= day_end`). Queries spanning more than 24 hours must default to aggregated views rather than raw line items.
