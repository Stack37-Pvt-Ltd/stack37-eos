-- 11. Business Setup & Configuration Schema
-- 
-- Extends public.organizations and public.branches with business profile,
-- contact channels, registered address, currency, timezone, tax details, and branch metadata.
-- Implements atomic SECURITY DEFINER configuration RPCs with audit logging.
-- Restricts public.organizations and public.branches from direct client writes to prevent audit bypass.
-- Restricts configuration operations strictly to active Primary Owners.
-- Enforces database-side validation for permitted currencies, IANA timezones, and tax statuses.
-- 
-- Note: Prepared locally for review; requires explicit CEO authorization before remote deployment.

-- 1. Extend public.organizations with Business Setup & Configuration columns
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS legal_name TEXT,
    ADD COLUMN IF NOT EXISTS registration_number TEXT,
    ADD COLUMN IF NOT EXISTS tax_id TEXT,
    ADD COLUMN IF NOT EXISTS tax_status TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS currency TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS address_line1 TEXT,
    ADD COLUMN IF NOT EXISTS address_line2 TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state_province TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Validation constraints for permitted currency, tax status, and country code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_org_currency_permitted'
    ) THEN
        ALTER TABLE public.organizations
            ADD CONSTRAINT check_org_currency_permitted
            CHECK (currency IS NULL OR currency IN (
                'USD', 'EUR', 'GBP', 'LKR', 'AUD', 'CAD', 'SGD', 'AED', 'INR', 'JPY', 'CHF', 'CNY', 'NZD'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_org_tax_status_permitted'
    ) THEN
        ALTER TABLE public.organizations
            ADD CONSTRAINT check_org_tax_status_permitted
            CHECK (tax_status IN ('standard', 'vat_registered', 'exempt', 'simplified'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_org_country_code_format'
    ) THEN
        ALTER TABLE public.organizations
            ADD CONSTRAINT check_org_country_code_format
            CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- 2. Extend public.branches with operating branch metadata and headquarters flag
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS is_headquarters BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS code TEXT DEFAULT 'HQ',
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS address_line1 TEXT,
    ADD COLUMN IF NOT EXISTS address_line2 TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state_province TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Enforce at most one headquarters branch per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_headquarters
    ON public.branches (organization_id) WHERE is_headquarters = true;

-- Backfill existing headquarters branches safely
UPDATE public.branches b
SET is_headquarters = true
WHERE b.name = 'Headquarters'
  AND NOT EXISTS (
      SELECT 1 FROM public.branches b2
      WHERE b2.organization_id = b.organization_id AND b2.is_headquarters = true
  );

-- For any organization with branches but none designated as headquarters, mark the earliest branch
UPDATE public.branches b
SET is_headquarters = true
WHERE b.id = (
    SELECT b3.id FROM public.branches b3
    WHERE b3.organization_id = b.organization_id
    ORDER BY b3.id ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM public.branches b4
    WHERE b4.organization_id = b.organization_id AND b4.is_headquarters = true
);

-- 3. Seed Regional Reference Configurations into existing country_configurations table
INSERT INTO public.country_configurations (country_code, currency_code, payload_json)
VALUES 
    ('LK', 'LKR', '{"name": "Sri Lanka", "default_timezone": "Asia/Colombo", "currency_symbol": "Rs"}'::jsonb),
    ('US', 'USD', '{"name": "United States", "default_timezone": "America/New_York", "currency_symbol": "$"}'::jsonb),
    ('GB', 'GBP', '{"name": "United Kingdom", "default_timezone": "Europe/London", "currency_symbol": "£"}'::jsonb),
    ('AE', 'AED', '{"name": "United Arab Emirates", "default_timezone": "Asia/Dubai", "currency_symbol": "AED"}'::jsonb),
    ('SG', 'SGD', '{"name": "Singapore", "default_timezone": "Asia/Singapore", "currency_symbol": "S$"}'::jsonb),
    ('AU', 'AUD', '{"name": "Australia", "default_timezone": "Australia/Sydney", "currency_symbol": "A$"}'::jsonb),
    ('IN', 'INR', '{"name": "India", "default_timezone": "Asia/Kolkata", "currency_symbol": "₹"}'::jsonb)
ON CONFLICT (country_code, effective_from) DO NOTHING;

-- 4. Database-Level Prevention of Direct Client Writes (No Audit Bypass)
DROP POLICY IF EXISTS "Tenant Update Orgs" ON public.organizations;
DROP POLICY IF EXISTS "Tenant Update Branches" ON public.branches;

REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM public, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.branches FROM public, anon, authenticated;
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.branches TO authenticated;

-- 5. Atomic Organization Configuration RPC with Audit Logging (Owner-Restricted)
CREATE OR REPLACE FUNCTION public.update_business_configuration(
    p_organization_id UUID,
    p_name TEXT,
    p_legal_name TEXT,
    p_registration_number TEXT,
    p_category_id UUID,
    p_currency TEXT,
    p_timezone TEXT,
    p_tax_id TEXT,
    p_tax_status TEXT,
    p_contact_email TEXT,
    p_contact_phone TEXT,
    p_website TEXT,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state_province TEXT,
    p_postal_code TEXT,
    p_country_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Strict Authorization Guard: Caller must be active Primary Owner
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_organization_id
          AND user_id = v_user_id
          AND status = 'active'
          AND is_owner = true
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only the active primary owner can configure business settings.';
    END IF;

    -- Invariant: Business name minimum length
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Business name must be at least 2 characters.';
    END IF;

    -- Database-side Permitted Currency Validation
    IF p_currency IS NOT NULL AND p_currency NOT IN (
        'USD', 'EUR', 'GBP', 'LKR', 'AUD', 'CAD', 'SGD', 'AED', 'INR', 'JPY', 'CHF', 'CNY', 'NZD'
    ) THEN
        RAISE EXCEPTION 'Invalid currency: % is not a permitted operating currency.', p_currency;
    END IF;

    -- Database-side IANA Timezone Validation against pg_timezone_names
    IF p_timezone IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_timezone_names WHERE name = p_timezone
    ) THEN
        RAISE EXCEPTION 'Invalid timezone: % is not a recognized IANA timezone identifier.', p_timezone;
    END IF;

    -- Database-side Permitted Tax Status Validation
    IF p_tax_status IS NOT NULL AND p_tax_status NOT IN (
        'standard', 'vat_registered', 'exempt', 'simplified'
    ) THEN
        RAISE EXCEPTION 'Invalid tax status: % is not a permitted tax status.', p_tax_status;
    END IF;

    -- Country Code Validation
    IF p_country_code IS NOT NULL AND NOT (p_country_code ~ '^[A-Z]{2}$') THEN
        RAISE EXCEPTION 'Country code must be a valid 2-letter uppercase ISO code.';
    END IF;

    -- Update organization configuration atomically
    UPDATE public.organizations
    SET
        name = COALESCE(NULLIF(TRIM(p_name), ''), name),
        legal_name = NULLIF(TRIM(p_legal_name), ''),
        registration_number = NULLIF(TRIM(p_registration_number), ''),
        category_id = p_category_id,
        currency = COALESCE(NULLIF(TRIM(p_currency), ''), currency),
        timezone = COALESCE(NULLIF(TRIM(p_timezone), ''), timezone),
        tax_id = NULLIF(TRIM(p_tax_id), ''),
        tax_status = COALESCE(NULLIF(TRIM(p_tax_status), ''), tax_status),
        contact_email = NULLIF(TRIM(p_contact_email), ''),
        contact_phone = NULLIF(TRIM(p_contact_phone), ''),
        website = NULLIF(TRIM(p_website), ''),
        address_line1 = NULLIF(TRIM(p_address_line1), ''),
        address_line2 = NULLIF(TRIM(p_address_line2), ''),
        city = NULLIF(TRIM(p_city), ''),
        state_province = NULLIF(TRIM(p_state_province), ''),
        postal_code = NULLIF(TRIM(p_postal_code), ''),
        country_code = COALESCE(NULLIF(TRIM(p_country_code), ''), country_code)
    WHERE id = p_organization_id;

    -- Record audit log atomically
    PERFORM private.insert_audit_log(
        p_organization_id,
        'business.configuration_updated',
        'organizations',
        jsonb_build_object(
            'name', p_name,
            'legal_name', p_legal_name,
            'registration_number', p_registration_number,
            'currency', p_currency,
            'timezone', p_timezone,
            'tax_id', p_tax_id,
            'tax_status', p_tax_status,
            'city', p_city,
            'country_code', p_country_code
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_business_configuration FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_business_configuration TO authenticated;

-- 6. Atomic Branch Configuration RPC with Audit Logging (Owner-Restricted)
CREATE OR REPLACE FUNCTION public.update_branch_configuration(
    p_organization_id UUID,
    p_branch_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_contact_email TEXT,
    p_contact_phone TEXT,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state_province TEXT,
    p_postal_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_branch_exists BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Strict Authorization Guard: Caller must be active Primary Owner
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_organization_id
          AND user_id = v_user_id
          AND status = 'active'
          AND is_owner = true
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only the active primary owner can modify branch details.';
    END IF;

    -- Verify target branch belongs to the specified organization
    SELECT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = p_organization_id
    ) INTO v_branch_exists;

    IF NOT v_branch_exists THEN
        RAISE EXCEPTION 'Branch % does not belong to organization %.', p_branch_id, p_organization_id;
    END IF;

    -- Validation checks
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Branch name must be at least 2 characters.';
    END IF;

    -- Update branch metadata
    UPDATE public.branches
    SET
        name = COALESCE(NULLIF(TRIM(p_name), ''), name),
        code = COALESCE(NULLIF(TRIM(p_code), ''), 'HQ'),
        contact_email = NULLIF(TRIM(p_contact_email), ''),
        contact_phone = NULLIF(TRIM(p_contact_phone), ''),
        address_line1 = NULLIF(TRIM(p_address_line1), ''),
        address_line2 = NULLIF(TRIM(p_address_line2), ''),
        city = NULLIF(TRIM(p_city), ''),
        state_province = NULLIF(TRIM(p_state_province), ''),
        postal_code = NULLIF(TRIM(p_postal_code), '')
    WHERE id = p_branch_id AND organization_id = p_organization_id;

    -- Record audit log atomically
    PERFORM private.insert_audit_log(
        p_organization_id,
        'branch.configuration_updated',
        'branches',
        jsonb_build_object(
            'branch_id', p_branch_id,
            'name', p_name,
            'code', p_code,
            'city', p_city
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_branch_configuration FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_branch_configuration TO authenticated;
