-- 10. Initial Workspace Provisioning & Foundational RBAC Setup
-- 
-- Security & Invariants:
-- 1. Places provision_workspace_defaults in private schema with restricted EXECUTE (postgres, service_role).
--    Unexposed to PostgREST; cannot be invoked directly by arbitrary authenticated users.
-- 2. Idempotent unique indexes per organization:
--    - idx_roles_org_name on public.roles(organization_id, name)
--    - idx_branches_org_name on public.branches(organization_id, name) (eliminates duplicate branch race condition)
-- 3. Explicit owner validation: fails with exception if organization has no active primary owner.
-- 4. Idempotently provisions foundational system roles:
--    - 'Administrator' (strictly whitelisted: 'manage_team', 'audit:read' per documented policy)
--    - 'Member' (standard base role)
-- 5. Idempotently links primary owner to Headquarters branch and Administrator role.
-- 6. Updates public.create_business RPC to invoke private.provision_workspace_defaults atomically.
-- 7. Backfills existing completed organizations with non-destructive ON CONFLICT DO NOTHING.
-- 
-- Note: Prepared locally for review; requires explicit authorization before remote deployment.

-- 1. Idempotent unique indexes per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_name 
    ON public.roles (organization_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_name 
    ON public.branches (organization_id, name);

-- 2. Private Workspace Defaults Initialization Procedure
CREATE OR REPLACE FUNCTION private.provision_workspace_defaults(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_owner_mem_id UUID;
    v_branch_id UUID;
    v_admin_role_id UUID;
    v_member_role_id UUID;
BEGIN
    -- 1. Locate primary owner membership (fail explicitly if missing)
    SELECT id INTO v_owner_mem_id
    FROM public.organization_members
    WHERE organization_id = p_org_id AND is_owner = true AND status = 'active'
    LIMIT 1;

    IF v_owner_mem_id IS NULL THEN
        RAISE EXCEPTION 'Provisioning failure: Organization % has no valid active primary owner.', p_org_id;
    END IF;

    -- 2. Ensure Headquarters branch exists (concurrency-safe via unique index)
    INSERT INTO public.branches (organization_id, name)
    VALUES (p_org_id, 'Headquarters')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_branch_id;

    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id
        FROM public.branches
        WHERE organization_id = p_org_id AND name = 'Headquarters'
        LIMIT 1;
    END IF;

    -- 3. Link primary owner to Headquarters branch (idempotent, collision-safe)
    INSERT INTO public.membership_branches (organization_id, membership_id, branch_id)
    VALUES (p_org_id, v_owner_mem_id, v_branch_id)
    ON CONFLICT (organization_id, membership_id, branch_id) DO NOTHING;

    -- 4. Ensure foundational roles exist
    -- 4a. Administrator system role
    INSERT INTO public.roles (organization_id, name, is_system)
    VALUES (p_org_id, 'Administrator', true)
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_admin_role_id;

    IF v_admin_role_id IS NULL THEN
        SELECT id INTO v_admin_role_id
        FROM public.roles
        WHERE organization_id = p_org_id AND name = 'Administrator';
    END IF;

    -- 4b. Member standard role
    INSERT INTO public.roles (organization_id, name, is_system)
    VALUES (p_org_id, 'Member', false)
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_member_role_id;

    IF v_member_role_id IS NULL THEN
        SELECT id INTO v_member_role_id
        FROM public.roles
        WHERE organization_id = p_org_id AND name = 'Member';
    END IF;

    -- 5. Map explicitly whitelisted reference permissions to Administrator role
    -- Restricted to ('manage_team', 'audit:read') per documented authorization policy
    INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
    SELECT p_org_id, v_admin_role_id, p.id
    FROM public.permissions p
    WHERE p.id IN ('manage_team', 'audit:read')
    ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

    -- 6. Assign primary owner to Administrator role
    INSERT INTO public.membership_roles (organization_id, membership_id, role_id)
    VALUES (p_org_id, v_owner_mem_id, v_admin_role_id)
    ON CONFLICT (organization_id, membership_id, role_id) DO NOTHING;
END;
$$;

-- Restrict execution: private helper accessible only to postgres/service_role
REVOKE ALL ON FUNCTION private.provision_workspace_defaults(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.provision_workspace_defaults(UUID) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION private.provision_workspace_defaults(UUID) TO postgres, service_role;

-- 3. Update public.create_business RPC to atomically invoke private.provision_workspace_defaults
CREATE OR REPLACE FUNCTION public.create_business(
    p_name TEXT,
    p_slug TEXT,
    p_plan_id UUID,
    p_country_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID := auth.uid();
    v_profile_exists BOOLEAN;
    v_plan_valid BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_profile_exists;
    IF NOT v_profile_exists THEN
        RAISE EXCEPTION 'User profile not provisioned yet.';
    END IF;
    
    SELECT is_public INTO v_plan_valid FROM public.plans WHERE id = p_plan_id;
    IF v_plan_valid IS NULL OR NOT v_plan_valid THEN
        RAISE EXCEPTION 'Invalid or private subscription plan selected.';
    END IF;

    -- 1. Create Organization
    INSERT INTO public.organizations (name, slug, country_code, provisioning_status)
    VALUES (p_name, p_slug, p_country_code, 'completed')
    RETURNING id INTO v_org_id;

    -- 2. Assign Primary Owner
    INSERT INTO public.organization_members (organization_id, user_id, is_owner, status)
    VALUES (v_org_id, v_user_id, true, 'active');

    -- 3. Create Default Branch (idempotent / conflict safe)
    INSERT INTO public.branches (organization_id, name)
    VALUES (v_org_id, 'Headquarters')
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- 4. Assign Subscription (Exact 7-day free trial using DB timestamp)
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end)
    VALUES (v_org_id, p_plan_id, 'trialing', now() + interval '7 days');

    -- 5. Audit Log (safely called inside SECURITY DEFINER)
    PERFORM private.insert_audit_log(
        v_org_id,
        'business.created',
        'organizations',
        jsonb_build_object('name', p_name, 'slug', p_slug)
    );

    -- 6. Provision Operational Workspace Defaults atomically
    PERFORM private.provision_workspace_defaults(v_org_id);

    RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_business(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business(TEXT, TEXT, UUID, TEXT) TO authenticated;

-- 4. Idempotently backfill existing completed organizations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id 
        FROM public.organizations 
        WHERE provisioning_status = 'completed' 
    LOOP
        PERFORM private.provision_workspace_defaults(r.id);
    END LOOP;
END;
$$;
