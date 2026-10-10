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
