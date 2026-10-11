-- 03. Memberships, Ownership, Branches, Roles, Invitations

CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id),
    UNIQUE (organization_id, id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_members FROM public, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.organization_members TO authenticated;

CREATE UNIQUE INDEX one_owner_per_org ON public.organization_members(organization_id) WHERE is_owner = true;

CREATE OR REPLACE FUNCTION public.check_organization_owner()
RETURNS TRIGGER AS $$
DECLARE
    owner_count INT;
    org_active BOOLEAN;
    org_id_to_check UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        org_id_to_check := OLD.organization_id;
    ELSE
        org_id_to_check := NEW.organization_id;
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id = org_id_to_check AND provisioning_status = 'completed') INTO org_active;
    
    IF org_active THEN
        SELECT COUNT(*) INTO owner_count 
        FROM public.organization_members 
        WHERE organization_id = org_id_to_check 
          AND is_owner = true 
          AND status = 'active';
          
        IF owner_count != 1 THEN
            RAISE EXCEPTION 'An active organization must have exactly one active primary owner. Current count: %', owner_count;
        END IF;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.organization_id != NEW.organization_id) OR TG_OP = 'DELETE' THEN
        SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id = OLD.organization_id AND provisioning_status = 'completed') INTO org_active;
        IF org_active THEN
            SELECT COUNT(*) INTO owner_count 
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
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ensure_one_active_owner
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_organization_owner();

-- NEW: Trigger directly on the organizations table to catch creation without owners
CREATE OR REPLACE FUNCTION public.check_org_provisioned_owner()
RETURNS TRIGGER AS $$
DECLARE
    owner_count INT;
BEGIN
    IF NEW.provisioning_status = 'completed' THEN
        SELECT COUNT(*) INTO owner_count 
        FROM public.organization_members 
        WHERE organization_id = NEW.id AND is_owner = true AND status = 'active';
        
        IF owner_count != 1 THEN
            RAISE EXCEPTION 'An active organization must have exactly one active primary owner upon provisioning. Current count: %', owner_count;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ensure_org_has_owner
AFTER INSERT OR UPDATE ON public.organizations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_org_provisioned_owner();


CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (organization_id, id)
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branches FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;

CREATE TABLE public.membership_branches (
    organization_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    PRIMARY KEY (organization_id, membership_id, branch_id),
    FOREIGN KEY (organization_id, membership_id) REFERENCES public.organization_members(organization_id, id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id) ON DELETE CASCADE
);
ALTER TABLE public.membership_branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_branches FROM public, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.membership_branches TO authenticated;

CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (organization_id, id)
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roles FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;

CREATE TABLE public.permissions (
    id TEXT PRIMARY KEY,
    module_name TEXT NOT NULL,
    action TEXT NOT NULL
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.permissions FROM public, anon, authenticated;
GRANT SELECT ON public.permissions TO authenticated;

CREATE TABLE public.role_permissions (
    organization_id UUID NOT NULL,
    role_id UUID NOT NULL,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (organization_id, role_id, permission_id),
    FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id) ON DELETE CASCADE
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_permissions FROM public, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;

CREATE TABLE public.membership_roles (
    organization_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (organization_id, membership_id, role_id),
    FOREIGN KEY (organization_id, membership_id) REFERENCES public.organization_members(organization_id, id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id) ON DELETE CASCADE
);
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_roles FROM public, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.membership_roles TO authenticated;

CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    role_id UUID,
    branch_id UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id) ON DELETE CASCADE
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM public, anon, authenticated;
GRANT SELECT (id, organization_id, email, role_id, branch_id, status, expires_at, accepted_at) ON public.invitations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
