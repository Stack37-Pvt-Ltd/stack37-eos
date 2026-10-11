-- 06. Security Definer RPCs

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

    -- 2. Assign Owner
    INSERT INTO public.organization_members (organization_id, user_id, is_owner, status)
    VALUES (v_org_id, v_user_id, true, 'active');

    -- 3. Create Default Branch
    INSERT INTO public.branches (organization_id, name)
    VALUES (v_org_id, 'Headquarters');

    -- 4. Assign Subscription
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end)
    VALUES (v_org_id, p_plan_id, 'trialing', now() + interval '14 days');

    -- 5. Audit Log (safely called inside SECURITY DEFINER)
    PERFORM private.insert_audit_log(
        v_org_id,
        'business.created',
        'organizations',
        jsonb_build_object('name', p_name, 'slug', p_slug)
    );

    RETURN v_org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_business FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business TO authenticated;


CREATE OR REPLACE FUNCTION public.transfer_ownership(
    p_organization_id UUID,
    p_new_owner_membership_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_owner_id UUID;
    v_actor_id UUID := auth.uid();
BEGIN
    -- Only the current active owner can execute this transfer, locking the row.
    SELECT user_id INTO v_current_owner_id
    FROM public.organization_members
    WHERE organization_id = p_organization_id AND is_owner = true AND status = 'active'
    FOR UPDATE;

    IF v_current_owner_id IS NULL OR v_current_owner_id != v_actor_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the active primary owner can transfer ownership.';
    END IF;
    
    -- Ensure the target membership is valid, belongs to the org, and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE id = p_new_owner_membership_id AND organization_id = p_organization_id AND status = 'active'
        FOR UPDATE
    ) THEN
        RAISE EXCEPTION 'Target membership is invalid or not active in this organization.';
    END IF;

    UPDATE public.organization_members 
    SET is_owner = false 
    WHERE organization_id = p_organization_id AND is_owner = true;

    UPDATE public.organization_members 
    SET is_owner = true 
    WHERE id = p_new_owner_membership_id AND organization_id = p_organization_id AND status = 'active';

    PERFORM private.insert_audit_log(
        p_organization_id,
        'ownership.transferred',
        'organization_members',
        jsonb_build_object('new_owner_membership_id', p_new_owner_membership_id)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_ownership FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_ownership TO authenticated;
