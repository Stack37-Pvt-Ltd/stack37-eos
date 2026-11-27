-- Migration: 20261128000002_harden_legacy_function_search_paths.sql
-- Description: Harden legacy trigger functions by pinning search_path = '' and using fully-qualified references.
-- Functions: public.handle_new_user(), public.check_organization_owner(), public.check_org_provisioned_owner()

-- 1. Harden public.handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', pg_catalog.split_part(NEW.email, '@', 1)),
      NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

-- 2. Harden public.check_organization_owner()
CREATE OR REPLACE FUNCTION public.check_organization_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    owner_count pg_catalog.int4;
    org_active pg_catalog.bool;
    org_id_to_check pg_catalog.uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        org_id_to_check := OLD.organization_id;
    ELSE
        org_id_to_check := NEW.organization_id;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.organizations
        WHERE id = org_id_to_check AND provisioning_status = 'completed'
    ) INTO org_active;
    
    IF org_active THEN
        SELECT pg_catalog.count(*) INTO owner_count 
        FROM public.organization_members 
        WHERE organization_id = org_id_to_check 
          AND is_owner = true 
          AND status = 'active';
          
        IF owner_count != 1 THEN
            RAISE EXCEPTION 'An active organization must have exactly one active primary owner. Current count: %', owner_count;
        END IF;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.organization_id != NEW.organization_id) OR TG_OP = 'DELETE' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.organizations
            WHERE id = OLD.organization_id AND provisioning_status = 'completed'
        ) INTO org_active;
        IF org_active THEN
            SELECT pg_catalog.count(*) INTO owner_count 
            FROM public.organization_members 
            WHERE organization_id = OLD.organization_id 
              AND is_owner = true 
              AND status = 'active';
              
            IF owner_count != 1 THEN
                RAISE EXCEPTION 'Membership modification left original organization without exactly one active owner.';
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_organization_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_organization_owner() TO authenticated, service_role;

-- 3. Harden public.check_org_provisioned_owner()
CREATE OR REPLACE FUNCTION public.check_org_provisioned_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    owner_count pg_catalog.int4;
BEGIN
    IF NEW.provisioning_status = 'completed' THEN
        SELECT pg_catalog.count(*) INTO owner_count 
        FROM public.organization_members 
        WHERE organization_id = NEW.id AND is_owner = true AND status = 'active';
        
        IF owner_count != 1 THEN
            RAISE EXCEPTION 'An active organization must have exactly one active primary owner upon provisioning. Current count: %', owner_count;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_org_provisioned_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_org_provisioned_owner() TO authenticated, service_role;

COMMENT ON FUNCTION public.handle_new_user() IS 'Hardened profile provisioning trigger with empty search_path';
COMMENT ON FUNCTION public.check_organization_owner() IS 'Hardened ownership integrity constraint trigger with empty search_path';
COMMENT ON FUNCTION public.check_org_provisioned_owner() IS 'Hardened organization provisioning ownership constraint trigger with empty search_path';
