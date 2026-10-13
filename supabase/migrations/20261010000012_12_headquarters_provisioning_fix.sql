-- 12. Headquarters Provisioning Fix
-- 
-- Ensures that newly registered organizations explicitly designate their initial
-- Headquarters operating branch with is_headquarters = true and code = 'HQ'.
-- Updates private.provision_workspace_defaults and public.create_business RPCs:
--   1. Centralizes branch creation in private.provision_workspace_defaults to eliminate
--      duplicate branch creation between create_business and provision_workspace_defaults.
--   2. Preserves already designated Headquarters branches resolved by is_headquarters = true,
--      regardless of their current name (e.g. after being renamed).
--   3. Never alters an existing organization's Headquarters designation merely because another
--      branch happens to be named "Headquarters".
--   4. Preserves atomic provisioning transaction, ownership invariant, seven-day trial, and audit logging.
-- 
-- Note: Prepared locally for review; requires explicit CEO authorization before remote deployment.

-- 1. Update private.provision_workspace_defaults helper
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

    -- 2. Resolve or create Headquarters operating branch
    -- 2a. First, preserve already designated Headquarters branch (resolved by is_headquarters = true, regardless of name)
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE organization_id = p_org_id AND is_headquarters = true
    LIMIT 1;

    -- 2b. If no branch is currently designated as Headquarters, check for legacy unflagged 'Headquarters' branch
    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id
        FROM public.branches
        WHERE organization_id = p_org_id AND name = 'Headquarters'
        LIMIT 1;

        IF v_branch_id IS NOT NULL THEN
            UPDATE public.branches
            SET is_headquarters = true,
                code = COALESCE(code, 'HQ')
            WHERE id = v_branch_id;
        ELSE
            -- 2c. No Headquarters branch exists at all: create the initial Headquarters branch
            INSERT INTO public.branches (organization_id, name, is_headquarters, code)
            VALUES (p_org_id, 'Headquarters', true, 'HQ')
            ON CONFLICT (organization_id, name) DO NOTHING
            RETURNING id INTO v_branch_id;

            IF v_branch_id IS NULL THEN
                SELECT id INTO v_branch_id
                FROM public.branches
                WHERE organization_id = p_org_id AND (is_headquarters = true OR name = 'Headquarters')
                ORDER BY is_headquarters DESC, id ASC
                LIMIT 1;
            END IF;
        END IF;
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
        WHERE organization_id = p_org_id AND name = 'Administrator'
        LIMIT 1;
    END IF;

    -- 4b. Member standard role
    INSERT INTO public.roles (organization_id, name, is_system)
    VALUES (p_org_id, 'Member', false)
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_member_role_id;

    IF v_member_role_id IS NULL THEN
        SELECT id INTO v_member_role_id
        FROM public.roles
        WHERE organization_id = p_org_id AND name = 'Member'
        LIMIT 1;
    END IF;

    -- 5. Grant foundational permissions to Administrator role
    INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
    SELECT p_org_id, v_admin_role_id, p.id
    FROM public.permissions p
    WHERE p.id IN ('manage_team', 'audit:read')
    ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

    -- 6. Assign Primary Owner to Administrator role
    INSERT INTO public.membership_roles (organization_id, membership_id, role_id)
    VALUES (p_org_id, v_owner_mem_id, v_admin_role_id)
    ON CONFLICT (organization_id, membership_id, role_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION private.provision_workspace_defaults(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.provision_workspace_defaults(UUID) TO postgres, service_role;

-- 2. Update public.create_business RPC
-- Centralizes operational workspace provisioning inside private.provision_workspace_defaults
-- to avoid redundant duplicate branch creation between create_business and provision_workspace_defaults.
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

    -- 3. Assign Subscription (Exact 7-day free trial using DB timestamp)
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end)
    VALUES (v_org_id, p_plan_id, 'trialing', now() + interval '7 days');

    -- 4. Audit Log (safely called inside SECURITY DEFINER)
    PERFORM private.insert_audit_log(
        v_org_id,
        'business.created',
        'organizations',
        jsonb_build_object('name', p_name, 'slug', p_slug)
    );

    -- 5. Atomically provision Operational Workspace Defaults
    -- (Creates single Headquarters branch with is_headquarters=true, code='HQ',
    --  links owner to branch, provisions Administrator/Member roles, and assigns permissions)
    PERFORM private.provision_workspace_defaults(v_org_id);

    RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_business(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business(TEXT, TEXT, UUID, TEXT) TO authenticated;

-- 3. Ensure any legacy organizations lacking a designated headquarters are safely reconciled
WITH target_branches AS (
    SELECT DISTINCT ON (organization_id) id
    FROM public.branches
    WHERE (name = 'Headquarters' OR code = 'HQ')
      AND is_headquarters = false
      AND organization_id NOT IN (
          SELECT organization_id FROM public.branches WHERE is_headquarters = true
      )
    ORDER BY organization_id, id ASC
)
UPDATE public.branches b
SET is_headquarters = true,
    code = COALESCE(b.code, 'HQ')
FROM target_branches t
WHERE b.id = t.id;
