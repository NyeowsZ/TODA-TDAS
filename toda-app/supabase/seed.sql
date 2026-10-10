-- ============================================================================
-- Dacotoda (TODA) Seed Data Script
-- Populates Auth Users, User Profiles, Sample Drivers, and Initial Dispatch Logs
-- Common password for all seed accounts: Password123!
-- ============================================================================

DO $$
DECLARE
    uid_chairman    UUID := 'a0000000-0000-0000-0000-000000000001';
    uid_secretary   UUID := 'a0000000-0000-0000-0000-000000000002';
    uid_auditor     UUID := 'a0000000-0000-0000-0000-000000000003';
    uid_controller1 UUID := 'a0000000-0000-0000-0000-000000000004';
    uid_controller2 UUID := 'a0000000-0000-0000-0000-000000000005';

    enc_pw TEXT := crypt('Password123!', gen_salt('bf'));
    has_provider_id BOOLEAN;
    id_data_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) INTO has_provider_id;

    SELECT data_type INTO id_data_type
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'id';

    -- 1. AUTH USERS WITH NON-NULL TOKEN COLUMNS
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES 
        ('00000000-0000-0000-0000-000000000000', uid_chairman, 'authenticated', 'authenticated', 'chairman@toda.local', enc_pw, NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Manuel Roxas","role":"chairman"}'::jsonb, NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000000', uid_secretary, 'authenticated', 'authenticated', 'secretary@toda.local', enc_pw, NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Corazon Aquino","role":"secretary"}'::jsonb, NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000000', uid_auditor, 'authenticated', 'authenticated', 'auditor@toda.local', enc_pw, NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ramon Magsaysay","role":"auditor"}'::jsonb, NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000000', uid_controller1, 'authenticated', 'authenticated', 'controller1@toda.local', enc_pw, NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Juan Dispatcher (Booth 1)","role":"controller"}'::jsonb, NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000000', uid_controller2, 'authenticated', 'authenticated', 'controller2@toda.local', enc_pw, NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Pedro Dispatcher (Booth 2)","role":"controller"}'::jsonb, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
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

    -- 2. AUTH IDENTITIES
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

    -- 3. USER PROFILES
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

-- Fix security linter: Ensure view uses invoker permissions
ALTER VIEW IF EXISTS public.view_driver_active_summaries SET (security_invoker = true);

-- SYNC: Ensure ALL auth users have active user_profiles matching their role
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

-- 4. SAMPLE REGISTERED DRIVERS
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

-- 5. DRIVER PROFILE VERSIONS (SCD-2)
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

-- 6. SAMPLE DISPATCH LOGS
INSERT INTO public.dispatch_logs (driver_id, controller_id, launch_count, logged_at, is_voided, void_reason)
VALUES
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '120 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000088', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '95 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000155', 'a0000000-0000-0000-0000-000000000004', 2, NOW() - INTERVAL '70 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000204', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '40 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '20 minutes', false, null),
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '15 minutes', true, 'Entered wrong launch multiplier (voided within 2m window)'),
    ('d0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '14 minutes', false, null);
