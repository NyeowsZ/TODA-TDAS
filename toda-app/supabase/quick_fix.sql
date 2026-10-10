-- ============================================================================
-- QUICK FIX: Run this once in Supabase SQL Editor
-- 1. Fix Security Definer View warning (CRITICAL linter issue)
-- 2. Upgrade current_user_role() with multi-tier fallback (user_profiles -> jwt -> auth.users)
-- 3. Upgrade dispatch_logs RLS policies so controllers can insert and view
-- 4. Sync all auth.users into user_profiles with active=true and correct role
-- 5. Ensure Realtime publication includes dispatch_logs
-- ============================================================================

-- 1. Fix Security Definer View
ALTER VIEW IF EXISTS public.view_driver_active_summaries SET (security_invoker = true);

-- 2. Resilient current_user_role() function
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
    SELECT role INTO r 
    FROM public.user_profiles 
    WHERE id = auth.uid() AND is_active = true;
    
    IF r IS NOT NULL THEN
        RETURN r;
    END IF;

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

-- 3. Resilient dispatch_logs policies
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
    auth.uid() = controller_id
    OR public.current_user_role() IN ('official', 'auditor', 'secretary', 'chairman')
    OR (auth.jwt()->'user_metadata'->>'role') IN ('official', 'auditor', 'secretary', 'chairman')
    OR EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('official', 'auditor', 'secretary', 'chairman') AND is_active = true
    )
);

-- 4. Sync all existing auth users into user_profiles
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
    is_active = true;

-- 5. Ensure Realtime is enabled on dispatch_logs
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 6. UPGRADE: ROUTES TABLE & REAL DRIVER IDENTITY (FIRST/LAST/MI/NICKNAME)
-- ============================================================================

-- Create routes table
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO public.routes (name, is_active, sort_order) VALUES
    ('Guinsay', true, 1),
    ('Taytay', true, 2),
    ('Sabang', true, 3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view routes" ON public.routes;
CREATE POLICY "Authenticated users can view routes"
ON public.routes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Officials can manage routes" ON public.routes;
CREATE POLICY "Officials can manage routes"
ON public.routes FOR ALL
TO authenticated
USING (public.current_user_role() IN ('official', 'secretary', 'chairman'))
WITH CHECK (public.current_user_role() IN ('official', 'secretary', 'chairman'));

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Upgrade dispatch_logs to include route
ALTER TABLE public.dispatch_logs ADD COLUMN IF NOT EXISTS route VARCHAR(50) DEFAULT 'Guinsay';

-- Upgrade driver_profile_versions to include discrete name fields
ALTER TABLE public.driver_profile_versions ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE public.driver_profile_versions ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE public.driver_profile_versions ADD COLUMN IF NOT EXISTS middle_initial VARCHAR(10) DEFAULT '—';
ALTER TABLE public.driver_profile_versions ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);

-- Backfill any existing driver profile versions where discrete fields are null
UPDATE public.driver_profile_versions
SET 
    first_name = COALESCE(first_name, CASE 
        WHEN position(',' in full_name) > 0 THEN trim(split_part(full_name, ',', 2))
        ELSE split_part(full_name, ' ', 1)
    END),
    last_name = COALESCE(last_name, CASE 
        WHEN position(',' in full_name) > 0 THEN trim(split_part(full_name, ',', 1))
        WHEN position(' ' in full_name) > 0 THEN trim(substring(full_name from position(' ' in full_name) + 1))
        ELSE full_name
    END),
    nickname = COALESCE(nickname, CASE
        WHEN position(',' in full_name) > 0 THEN split_part(trim(split_part(full_name, ',', 2)), ' ', 1)
        ELSE split_part(full_name, ' ', 1)
    END)
WHERE first_name IS NULL OR last_name IS NULL;

-- Recreate view_driver_active_summaries with discrete columns
DROP VIEW IF EXISTS public.view_driver_active_summaries CASCADE;
CREATE VIEW public.view_driver_active_summaries
WITH (security_invoker = true) AS
SELECT
    d.id,
    d.body_number,
    COALESCE(v.first_name, '') AS first_name,
    COALESCE(v.last_name, '') AS last_name,
    COALESCE(v.middle_initial, '—') AS middle_initial,
    COALESCE(v.nickname, '') AS nickname,
    v.full_name,
    v.driver_photo_url,
    d.status
FROM public.drivers d
JOIN public.driver_profile_versions v
    ON d.id = v.driver_id
    AND d.current_version = v.version;

ALTER VIEW public.view_driver_active_summaries SET (security_invoker = true);
