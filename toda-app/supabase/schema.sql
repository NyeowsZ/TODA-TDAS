-- ============================================================================
-- Dacotoda (TODA) Management & Information System
-- Production Database Schema & Security Blueprint
-- Conforms strictly to SYSTEM_ARCHITECTURE.md & INVARIANTS.md
-- Timezone Standard: UTC stored, Asia/Manila (GMT+8) display
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USER ROLES ENUM
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('controller', 'official', 'auditor', 'secretary', 'chairman');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. DYNAMIC SYSTEM CONFIGURATION
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Seed initial system settings
INSERT INTO public.system_settings (key, value) VALUES
    ('sanity_multiplier_threshold', '{"threshold": 10}'),
    ('controller_undo_window_minutes', '{"minutes": 2}'),
    ('auditor_revision_window_hours', '{"hours": 36}'),
    ('grace_period_controller', '{"seconds": 120}'),
    ('grace_period_auditor', '{"hours": 36}'),
    ('dispatch_sanity_threshold', '{"threshold": 10}'),
    ('operating_hours', '{"start": "05:00", "end": "23:00"}')
ON CONFLICT (key) DO NOTHING;

-- 4. USER PROFILES (Maps 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role app_role NOT NULL DEFAULT 'controller',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DRIVERS (Identity Anchor — Immutable Body Number Anchor)
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    body_number VARCHAR(20) UNIQUE NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_drivers_body_num ON public.drivers(body_number);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);

-- 6. DRIVER PROFILE VERSIONS (Immutable SCD-2 History)
CREATE TABLE IF NOT EXISTS public.driver_profile_versions (
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

CREATE INDEX IF NOT EXISTS idx_driver_versions_lookup ON public.driver_profile_versions(driver_id, version);

-- 7. DISPATCH LEDGER (Append-Only — Hard Deletes Prohibited)
CREATE TABLE IF NOT EXISTS public.dispatch_logs (
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

CREATE INDEX IF NOT EXISTS idx_dispatch_controller_recent
    ON public.dispatch_logs(controller_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_audit_lookup
    ON public.dispatch_logs(logged_at, is_voided);

CREATE INDEX IF NOT EXISTS idx_dispatch_driver_date
    ON public.dispatch_logs(driver_id, logged_at DESC);

-- 8. AUDIT ADJUSTMENTS (36-Hour Window Adjustments by Officials)
CREATE TABLE IF NOT EXISTS public.audit_adjustments (
    id BIGSERIAL PRIMARY KEY,
    dispatch_id BIGINT NOT NULL REFERENCES public.dispatch_logs(id),
    official_id UUID NOT NULL REFERENCES auth.users(id),
    adjustment_type VARCHAR(50) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_adjustments_dispatch
    ON public.audit_adjustments(dispatch_id);

CREATE INDEX IF NOT EXISTS idx_audit_adjustments_date
    ON public.audit_adjustments(created_at DESC);

-- 9. LIGHTWEIGHT IN-MEMORY HYDRATION VIEW (INV-NET-02)
CREATE OR REPLACE VIEW public.view_driver_active_summaries AS
SELECT
    d.id,
    d.body_number,
    v.full_name,
    v.driver_photo_url,
    d.status
FROM public.drivers d
JOIN public.driver_profile_versions v
    ON d.id = v.driver_id
    AND d.current_version = v.version;

-- ============================================================================
-- SECURITY FUNCTIONS & ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Function: Resolve current user's role from public.user_profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS across all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_adjustments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- SYSTEM SETTINGS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Settings readable by authenticated staff" ON public.system_settings;
CREATE POLICY "Settings readable by authenticated staff"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Settings manageable only by chairman" ON public.system_settings;
CREATE POLICY "Settings manageable only by chairman"
ON public.system_settings FOR ALL
TO authenticated
USING (public.current_user_role() = 'chairman')
WITH CHECK (public.current_user_role() = 'chairman');

-- ----------------------------------------------------------------------------
-- USER PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles readable by authenticated staff" ON public.user_profiles;
CREATE POLICY "Profiles readable by authenticated staff"
ON public.user_profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update own profile name" ON public.user_profiles;
CREATE POLICY "Users can update own profile name"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- DRIVERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers readable by authenticated staff" ON public.drivers;
CREATE POLICY "Drivers readable by authenticated staff"
ON public.drivers FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Drivers manageable only by board" ON public.drivers;
CREATE POLICY "Drivers manageable only by board"
ON public.drivers FOR ALL
TO authenticated
USING (public.current_user_role() IN ('secretary', 'chairman'))
WITH CHECK (public.current_user_role() IN ('secretary', 'chairman'));

-- ----------------------------------------------------------------------------
-- DRIVER PROFILE VERSIONS POLICIES (Append-Only)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Versions readable by authenticated staff" ON public.driver_profile_versions;
CREATE POLICY "Versions readable by authenticated staff"
ON public.driver_profile_versions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Versions insertable only by board" ON public.driver_profile_versions;
CREATE POLICY "Versions insertable only by board"
ON public.driver_profile_versions FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() IN ('secretary', 'chairman'));

-- ----------------------------------------------------------------------------
-- DISPATCH LOGS POLICIES (POLP + Grace Window at Database Engine)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Controllers can insert own dispatches" ON public.dispatch_logs;
CREATE POLICY "Controllers can insert own dispatches"
ON public.dispatch_logs FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = controller_id
    AND public.current_user_role() = 'controller'
);

DROP POLICY IF EXISTS "Staff can view dispatches" ON public.dispatch_logs;
CREATE POLICY "Staff can view dispatches"
ON public.dispatch_logs FOR SELECT
TO authenticated
USING (
    (public.current_user_role() = 'controller' AND auth.uid() = controller_id)
    OR public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
);

-- Controller 2-Minute Undo Window enforced at DB Engine (INV-LOG-01)
DROP POLICY IF EXISTS "Controllers can undo within 2 minutes" ON public.dispatch_logs;
CREATE POLICY "Controllers can undo within 2 minutes"
ON public.dispatch_logs FOR UPDATE
TO authenticated
USING (
    public.current_user_role() = 'controller'
    AND auth.uid() = controller_id
    AND is_voided = FALSE
    AND logged_at >= (NOW() - (
        SELECT (COALESCE(value->>'minutes', '2'))::INTEGER * INTERVAL '1 minute'
        FROM public.system_settings
        WHERE key IN ('controller_undo_window_minutes', 'grace_period_controller')
        LIMIT 1
    ))
)
WITH CHECK (
    is_voided = TRUE
    AND voided_by = auth.uid()
);

-- ----------------------------------------------------------------------------
-- AUDIT ADJUSTMENTS POLICIES (36-Hour Window Enforced at DB Engine)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auditors can insert adjustments within 36 hours" ON public.audit_adjustments;
CREATE POLICY "Auditors can insert adjustments within 36 hours"
ON public.audit_adjustments FOR INSERT
TO authenticated
WITH CHECK (
    public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
    AND EXISTS (
        SELECT 1 FROM public.dispatch_logs dl
        WHERE dl.id = dispatch_id
        AND dl.logged_at >= (NOW() - (
            SELECT (COALESCE(value->>'hours', '36'))::INTEGER * INTERVAL '1 hour'
            FROM public.system_settings
            WHERE key IN ('auditor_revision_window_hours', 'grace_period_auditor')
            LIMIT 1
        ))
    )
);

DROP POLICY IF EXISTS "Audits readable by officials" ON public.audit_adjustments;
CREATE POLICY "Audits readable by officials"
ON public.audit_adjustments FOR SELECT
TO authenticated
USING (public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman'));

-- ============================================================================
-- SUPABASE REALTIME CONFIGURATION
-- Enable realtime publication for instant roster synchronization
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_logs;

-- ============================================================================
-- STORAGE BUCKET CONFIGURATION
-- Create 'driver-photos' bucket and access policies
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'driver-photos',
    'driver-photos',
    true,
    102400, -- 100 KB max per file (INV-NET-03)
    ARRAY['image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public driver photo access" ON storage.objects;
CREATE POLICY "Public driver photo access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-photos');

DROP POLICY IF EXISTS "Board can upload driver photos" ON storage.objects;
CREATE POLICY "Board can upload driver photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'driver-photos'
    AND public.current_user_role() IN ('secretary', 'chairman')
);
