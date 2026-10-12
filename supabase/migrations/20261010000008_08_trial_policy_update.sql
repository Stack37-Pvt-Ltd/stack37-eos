-- 08. Trial Policy Update (7-Day Free Trial) & Payment Provider Decoupling
-- Business Policy: My Business by STACK37 provides exactly a 7-day free trial on the Standard tier.
-- Future Payment Gateway: Lemon Squeezy (International) & potential local provider.
-- Notice: This migration is prepared locally for review and has NOT been applied to the remote cloud database.

-- 1. Forward-compatible Payment Provider Columns on public.subscriptions
-- Allows Lemon Squeezy or local gateways to manage subscriptions via webhook without schema redesign
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS external_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Index for fast webhook and subscription lookup by external provider
CREATE INDEX IF NOT EXISTS idx_subscriptions_external_lookup 
    ON public.subscriptions (provider, external_subscription_id)
    WHERE provider IS NOT NULL AND external_subscription_id IS NOT NULL;

-- 2. Standard Plan Trial Provisioning
-- Note: Price 0.00 is strictly a temporary development placeholder for trial provisioning,
-- NOT approved commercial pricing. Commercial pricing will be established upon Lemon Squeezy
-- product catalogue approval and Sri Lankan bank payout verification.
-- Any pre-existing plans (including Starter) remain untouched unless demonstrably required.
INSERT INTO public.plans (name, price, is_public)
VALUES ('Standard', 0, true)
ON CONFLICT (name) DO UPDATE 
SET is_public = true;

-- 3. Update public.create_business RPC with 7-Day Free Trial
-- Uses database server timestamp (now() + interval '7 days') to prevent client clock skew.
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

    -- 4. Assign Subscription (Exact 7-day free trial using DB timestamp; provider fields remain NULL pending checkout)
    INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_end)
    VALUES (v_org_id, p_plan_id, 'trialing', now() + interval '7 days');

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
