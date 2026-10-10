-- ============================================================================
-- Dacotoda (TODA) Management & Information System
-- Complete Production Database Setup & Seed Script
-- Conforms strictly to SYSTEM_ARCHITECTURE.md, INVARIANTS.md, and SYSTEM_UIUX.md
-- Timezone Standard: UTC stored in PostgreSQL, Asia/Manila (GMT+8) in display
-- 
-- INSTRUCTIONS FOR SUPABASE:
-- 1. Open your Supabase Project Dashboard -> SQL Editor
-- 2. Click "New Query", paste this entire file, and click "Run"
-- 3. All tables, functions, RLS policies, storage bucket, and test seed accounts
--    will be created cleanly and idempotently.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. USER ROLES ENUM
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('controller', 'official', 'auditor', 'secretary', 'chairman');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 3. DYNAMIC SYSTEM CONFIGURATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.system_settings (key, value) VALUES
    ('sanity_multiplier_threshold', '{"threshold": 10}'),
    ('controller_undo_window_minutes', '{"minutes": 2}'),
    ('auditor_revision_window_hours', '{"hours": 36}'),
    ('grace_period_controller', '{"seconds": 120}'),
    ('grace_period_auditor', '{"hours": 36}'),
    ('dispatch_sanity_threshold', '{"threshold": 10}'),
    ('operating_hours', '{"start": "05:00", "end": "23:00"}')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 4. USER PROFILES TABLE (Maps 1:1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role app_role NOT NULL DEFAULT 'controller',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. DRIVERS (Identity Anchor — Immutable Body Number Anchor)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 6. DRIVER PROFILE VERSIONS (Immutable SCD-2 History)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7. DISPATCH LEDGER (Append-Only — Hard Deletes Prohibited)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_logs (
    id BIGSERIAL PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    controller_id UUID NOT NULL REFERENCES auth.users(id),
    launch_count SMALLINT NOT NULL CHECK (launch_count > 0),
    route VARCHAR(50) DEFAULT 'Guinsay',
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

-- ----------------------------------------------------------------------------
-- 8. AUDIT ADJUSTMENTS (36-Hour Window Adjustments by Officials)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 9. LIGHTWEIGHT IN-MEMORY HYDRATION VIEW (INV-NET-02)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_driver_active_summaries CASCADE;
CREATE VIEW public.view_driver_active_summaries
WITH (security_invoker = true) AS
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

ALTER VIEW public.view_driver_active_summaries SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 10. HELPER FUNCTIONS & AUTH TRIGGERS
-- ----------------------------------------------------------------------------

-- Function: Resolve current user's role with multi-tier fallback (user_profiles -> jwt metadata)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    r app_role;
BEGIN
    -- 1. Check user_profiles table
    SELECT role INTO r 
    FROM public.user_profiles 
    WHERE id = auth.uid() AND is_active = true;
    
    IF r IS NOT NULL THEN
        RETURN r;
    END IF;

    -- 2. Fallback to JWT user metadata or app metadata
    BEGIN
        r := COALESCE(
            (auth.jwt()->'user_metadata'->>'role')::app_role,
            (auth.jwt()->'app_metadata'->>'role')::app_role
        );
        IF r IS NOT NULL THEN
            RETURN r;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        null;
    END;

    -- 3. Fallback directly to auth.users raw_user_meta_data
    BEGIN
        SELECT (raw_user_meta_data->>'role')::app_role INTO r
        FROM auth.users
        WHERE id = auth.uid();
        IF r IS NOT NULL THEN
            RETURN r;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        null;
    END;

    RETURN NULL;
END;
$$;

-- Trigger: Automatically create public.user_profiles on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_role app_role := 'controller';
    role_text text;
BEGIN
    role_text := NEW.raw_user_meta_data->>'role';
    IF role_text IN ('controller', 'official', 'auditor', 'secretary', 'chairman') THEN
        user_role := role_text::app_role;
    END IF;

    INSERT INTO public.user_profiles (id, full_name, role, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        user_role,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_adjustments ENABLE ROW LEVEL SECURITY;

-- SYSTEM SETTINGS POLICIES
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

-- USER PROFILES POLICIES
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

-- DRIVERS POLICIES
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

-- DRIVER PROFILE VERSIONS POLICIES (Append-Only)
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

-- DISPATCH LOGS POLICIES (POLP + Grace Window at Database Engine)
DROP POLICY IF EXISTS "Controllers can insert own dispatches" ON public.dispatch_logs;
CREATE POLICY "Controllers can insert own dispatches"
ON public.dispatch_logs FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = controller_id
    AND (
        public.current_user_role() = 'controller'
        OR (auth.jwt()->'user_metadata'->>'role') = 'controller'
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'controller' AND is_active = true
        )
    )
);

DROP POLICY IF EXISTS "Staff can view dispatches" ON public.dispatch_logs;
CREATE POLICY "Staff can view dispatches"
ON public.dispatch_logs FOR SELECT
TO authenticated
USING (
    -- Controllers can see their own logged dispatches
    auth.uid() = controller_id
    -- Officials / Auditors / Secretary / Chairman can see all dispatches
    OR public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
    OR (auth.jwt()->'user_metadata'->>'role') IN ('official', 'auditor', 'secretary', 'chairman')
    OR EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('official', 'auditor', 'secretary', 'chairman') AND is_active = true
    )
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

-- AUDIT ADJUSTMENTS POLICIES (36-Hour Window Enforced at DB Engine)
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

-- ----------------------------------------------------------------------------
-- 12. SUPABASE REALTIME CONFIGURATION
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 13. STORAGE BUCKET CONFIGURATION ('driver-photos')
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'driver-photos',
    'driver-photos',
    true,
    102400, -- 100 KB max per file (INV-NET-03)
    ARRAY['image/webp']
)
ON CONFLICT (id) DO NOTHING;

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

-- ============================================================================
-- 14. SEED DATA (ACCOUNTS, ROLES, DRIVERS & DISPATCH LOGS)
-- ============================================================================

DO $$
DECLARE
    -- Deterministic UUIDs for seed accounts
    uid_chairman   UUID := 'a0000000-0000-0000-0000-000000000001';
    uid_secretary  UUID := 'a0000000-0000-0000-0000-000000000002';
    uid_auditor    UUID := 'a0000000-0000-0000-0000-000000000003';
    uid_controller1 UUID := 'a0000000-0000-0000-0000-000000000004';
    uid_controller2 UUID := 'a0000000-0000-0000-0000-000000000005';

    -- Default common password: Password123!
    enc_pw TEXT := crypt('Password123!', gen_salt('bf'));

    has_provider_id BOOLEAN;
    id_data_type TEXT;
BEGIN
    -- Check if auth.identities has provider_id column and what data type id is
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) INTO has_provider_id;

    SELECT data_type INTO id_data_type
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'id';

    -- A. INSERT AUTH USERS WITH EXPLICIT NON-NULL TOKEN COLUMNS
    -- Note: GoTrue requires confirmation_token, recovery_token, etc. to be '' (not NULL)
    -- to avoid "Database error querying schema (Scan error on column converting NULL to string)"

    -- 1. Chairman
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid_chairman, 'authenticated', 'authenticated',
        'chairman@toda.local', enc_pw, NOW(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Manuel Roxas (Chairman)","role":"chairman"}'::jsonb,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = enc_pw,
        email_confirmed_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '';

    -- 2. Secretary
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid_secretary, 'authenticated', 'authenticated',
        'secretary@toda.local', enc_pw, NOW(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Corazon Aquino (Secretary)","role":"secretary"}'::jsonb,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = enc_pw,
        email_confirmed_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '';

    -- 3. Auditor / Official
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid_auditor, 'authenticated', 'authenticated',
        'auditor@toda.local', enc_pw, NOW(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Ramon Magsaysay (Auditor)","role":"auditor"}'::jsonb,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = enc_pw,
        email_confirmed_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '';

    -- 4. Controller 1 (Terminal Booth 1)
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid_controller1, 'authenticated', 'authenticated',
        'controller1@toda.local', enc_pw, NOW(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Juan Dispatcher (Booth 1)","role":"controller"}'::jsonb,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = enc_pw,
        email_confirmed_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '';

    -- 5. Controller 2 (Terminal Booth 2)
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid_controller2, 'authenticated', 'authenticated',
        'controller2@toda.local', enc_pw, NOW(),
        '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Pedro Dispatcher (Booth 2)","role":"controller"}'::jsonb,
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = enc_pw,
        email_confirmed_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '';

    -- REPAIR: Fix any NULL token columns for all seed users
    UPDATE auth.users
    SET 
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email LIKE '%@toda.local';

    -- B. INSERT AUTH IDENTITIES (Enables password sign-in with dynamic UUID/text compatibility)
    IF id_data_type = 'uuid' THEN
        IF has_provider_id THEN
            EXECUTE $q$
                INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), $1, jsonb_build_object('sub', $1::text, 'email', 'chairman@toda.local'), 'email', $1::text, NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $2, jsonb_build_object('sub', $2::text, 'email', 'secretary@toda.local'), 'email', $2::text, NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $3, jsonb_build_object('sub', $3::text, 'email', 'auditor@toda.local'), 'email', $3::text, NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $4, jsonb_build_object('sub', $4::text, 'email', 'controller1@toda.local'), 'email', $4::text, NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $5, jsonb_build_object('sub', $5::text, 'email', 'controller2@toda.local'), 'email', $5::text, NOW(), NOW(), NOW())
                ON CONFLICT DO NOTHING
            $q$ USING uid_chairman, uid_secretary, uid_auditor, uid_controller1, uid_controller2;
        ELSE
            EXECUTE $q$
                INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), $1, jsonb_build_object('sub', $1::text, 'email', 'chairman@toda.local'), 'email', NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $2, jsonb_build_object('sub', $2::text, 'email', 'secretary@toda.local'), 'email', NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $3, jsonb_build_object('sub', $3::text, 'email', 'auditor@toda.local'), 'email', NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $4, jsonb_build_object('sub', $4::text, 'email', 'controller1@toda.local'), 'email', NOW(), NOW(), NOW()),
                    (gen_random_uuid(), $5, jsonb_build_object('sub', $5::text, 'email', 'controller2@toda.local'), 'email', NOW(), NOW(), NOW())
                ON CONFLICT DO NOTHING
            $q$ USING uid_chairman, uid_secretary, uid_auditor, uid_controller1, uid_controller2;
        END IF;
    ELSE
        IF has_provider_id THEN
            EXECUTE $q$
                INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
                VALUES
                    ($1::text, $1, jsonb_build_object('sub', $1::text, 'email', 'chairman@toda.local'), 'email', $1::text, NOW(), NOW(), NOW()),
                    ($2::text, $2, jsonb_build_object('sub', $2::text, 'email', 'secretary@toda.local'), 'email', $2::text, NOW(), NOW(), NOW()),
                    ($3::text, $3, jsonb_build_object('sub', $3::text, 'email', 'auditor@toda.local'), 'email', $3::text, NOW(), NOW(), NOW()),
                    ($4::text, $4, jsonb_build_object('sub', $4::text, 'email', 'controller1@toda.local'), 'email', $4::text, NOW(), NOW(), NOW()),
                    ($5::text, $5, jsonb_build_object('sub', $5::text, 'email', 'controller2@toda.local'), 'email', $5::text, NOW(), NOW(), NOW())
                ON CONFLICT DO NOTHING
            $q$ USING uid_chairman, uid_secretary, uid_auditor, uid_controller1, uid_controller2;
        ELSE
            EXECUTE $q$
                INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                VALUES
                    ($1::text, $1, jsonb_build_object('sub', $1::text, 'email', 'chairman@toda.local'), 'email', NOW(), NOW(), NOW()),
                    ($2::text, $2, jsonb_build_object('sub', $2::text, 'email', 'secretary@toda.local'), 'email', NOW(), NOW(), NOW()),
                    ($3::text, $3, jsonb_build_object('sub', $3::text, 'email', 'auditor@toda.local'), 'email', NOW(), NOW(), NOW()),
                    ($4::text, $4, jsonb_build_object('sub', $4::text, 'email', 'controller1@toda.local'), 'email', NOW(), NOW(), NOW()),
                    ($5::text, $5, jsonb_build_object('sub', $5::text, 'email', 'controller2@toda.local'), 'email', NOW(), NOW(), NOW())
                ON CONFLICT DO NOTHING
            $q$ USING uid_chairman, uid_secretary, uid_auditor, uid_controller1, uid_controller2;
        END IF;
    END IF;

    -- C. ENSURE USER PROFILES EXIST WITH EXACT APP ROLES
    INSERT INTO public.user_profiles (id, full_name, role, is_active)
    VALUES
        (uid_chairman, 'Manuel Roxas', 'chairman', true),
        (uid_secretary, 'Corazon Aquino', 'secretary', true),
        (uid_auditor, 'Ramon Magsaysay', 'auditor', true),
        (uid_controller1, 'Juan Dispatcher (Booth 1)', 'controller', true),
        (uid_controller2, 'Pedro Dispatcher (Booth 2)', 'controller', true)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active;

END $$;

-- D. SYNC ALL AUTH USERS INTO PUBLIC.USER_PROFILES
INSERT INTO public.user_profiles (id, full_name, role, is_active)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE((u.raw_user_meta_data->>'role')::app_role, 'controller'),
    true
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- ----------------------------------------------------------------------------
-- 15. SEED DRIVERS & SCD-2 PROFILE VERSIONS
-- ----------------------------------------------------------------------------
INSERT INTO public.drivers (id, body_number, current_version, status, created_by)
VALUES
    ('d0000000-0000-0000-0000-000000000042', '042', 1, 'active', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000088', '088', 1, 'active', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000118', '118', 1, 'suspended', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000155', '155', 1, 'active', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000204', '204', 1, 'active', 'a0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000301', '301', 2, 'active', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (body_number) DO UPDATE SET
    status = EXCLUDED.status,
    current_version = EXCLUDED.current_version;

INSERT INTO public.driver_profile_versions (driver_id, version, full_name, contact_number, changed_by, change_reason)
VALUES
    ('d0000000-0000-0000-0000-000000000042', 1, 'Rodrigo Mendoza', '09171234567', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration'),
    ('d0000000-0000-0000-0000-000000000088', 1, 'Carlos Santos', '09182345678', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration'),
    ('d0000000-0000-0000-0000-000000000118', 1, 'Danilo Ramos', '09193456789', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration (Suspended: Route violation)'),
    ('d0000000-0000-0000-0000-000000000155', 1, 'Eduardo Reyes', '09204567890', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration'),
    ('d0000000-0000-0000-0000-000000000204', 1, 'Fernando Dizon', '09215678901', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration'),
    ('d0000000-0000-0000-0000-000000000301', 1, 'Gabriel Garcia Sr.', '09226789012', 'a0000000-0000-0000-0000-000000000002', 'Initial Registration'),
    ('d0000000-0000-0000-0000-000000000301', 2, 'Gabriel Garcia Jr.', '09226789012', 'a0000000-0000-0000-0000-000000000002', 'Franchise Transfer: Successor driver registered')
ON CONFLICT (driver_id, version) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 16. SEED SAMPLE DISPATCH LEDGER ENTRIES
-- ----------------------------------------------------------------------------
INSERT INTO public.dispatch_logs (driver_id, controller_id, launch_count, logged_at, is_voided, void_reason)
VALUES
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '120 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000088', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '95 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000155', 'a0000000-0000-0000-0000-000000000004', 2, NOW() - INTERVAL '70 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000204', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '40 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '20 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '15 minutes', true, 'Entered wrong launch multiplier (voided within 2m window)'),
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '14 minutes', false, null);
