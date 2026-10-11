-- 05. Row Level Security Policies and Authorization Logic

-- Secure Audit Insert RPC
CREATE OR REPLACE FUNCTION private.insert_audit_log(
    p_org_id UUID,
    p_action TEXT,
    p_resource TEXT,
    p_payload JSONB DEFAULT NULL
) RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
    v_actor_id UUID := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID);
BEGIN
    INSERT INTO public.audit_logs (organization_id, actor_id, action, resource, payload)
    VALUES (p_org_id, v_actor_id, p_action, p_resource, p_payload)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.insert_audit_log(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_audit_log(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.insert_audit_log(UUID, TEXT, TEXT, JSONB) TO postgres, service_role;

-- Helper function to get user orgs (SELECT ONLY)
CREATE OR REPLACE FUNCTION private.get_user_orgs()
RETURNS SETOF UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active';
$$;
REVOKE ALL ON FUNCTION private.get_user_orgs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_orgs() TO authenticated;

-- Centralized Authorization Resolver
CREATE OR REPLACE FUNCTION private.has_permission(p_org_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id 
          AND om.user_id = auth.uid() 
          AND om.status = 'active' 
          AND om.is_owner = true
        UNION
        SELECT 1 FROM public.organization_members om
        JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
        JOIN public.role_permissions rp ON rp.role_id = mr.role_id AND rp.organization_id = om.organization_id
        WHERE om.organization_id = p_org_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND rp.permission_id = p_action
    );
$$;
REVOKE ALL ON FUNCTION private.has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_permission(UUID, TEXT) TO authenticated;

-- Prevent Role Privilege Escalation
-- Validates if the current user holds EVERY permission present in the target role, AND prevents assigning system roles
CREATE OR REPLACE FUNCTION private.can_assign_role(p_org_id UUID, p_role_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    missing_permission TEXT;
    v_is_system BOOLEAN;
    v_is_owner BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_org_id AND user_id = auth.uid() AND is_owner = true AND status = 'active'
    ) INTO v_is_owner;

    SELECT is_system INTO v_is_system FROM public.roles WHERE id = p_role_id;
    
    -- Only owners can assign system roles
    IF v_is_system AND NOT v_is_owner THEN
        RETURN false;
    END IF;

    -- Owners can assign any role
    IF v_is_owner THEN
        RETURN true;
    END IF;

    -- For non-owners, check if they lack any permission that the target role grants
    SELECT rp.permission_id INTO missing_permission
    FROM public.role_permissions rp
    WHERE rp.role_id = p_role_id AND rp.organization_id = p_org_id
      AND NOT private.has_permission(p_org_id, rp.permission_id)
    LIMIT 1;

    -- If a missing permission is found, they cannot assign this role
    IF missing_permission IS NOT NULL THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.can_assign_role(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_assign_role(UUID, UUID) TO authenticated;

-- Global Configuration Read Policies
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (id = auth.uid() OR id IN (
    SELECT user_id FROM public.organization_members WHERE organization_id IN (SELECT private.get_user_orgs())
));
CREATE POLICY "Users Update Own Profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Public Read Categories" ON public.business_categories FOR SELECT USING (true);
CREATE POLICY "Public Read Countries" ON public.country_configurations FOR SELECT USING (true);
CREATE POLICY "Public Read Permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Public Read Plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Public Read Entitlements" ON public.entitlements FOR SELECT USING (true);
CREATE POLICY "Public Read PlanEntitlements" ON public.plan_entitlements FOR SELECT USING (true);
CREATE POLICY "Public Read Modules" ON public.modules FOR SELECT USING (true);

-- Tenant Read Policies
CREATE POLICY "Tenant Read Audit" ON public.audit_logs FOR SELECT USING (private.has_permission(organization_id, 'audit:read'));
CREATE POLICY "Tenant Read Orgs" ON public.organizations FOR SELECT USING (id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Domains" ON public.domains FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Members" ON public.organization_members FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Branches" ON public.branches FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read MemBranches" ON public.membership_branches FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Roles" ON public.roles FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read RolePerms" ON public.role_permissions FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read MemRoles" ON public.membership_roles FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Invitations" ON public.invitations FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read Subscriptions" ON public.subscriptions FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));
CREATE POLICY "Tenant Read OrgModules" ON public.organization_modules FOR SELECT USING (organization_id IN (SELECT private.get_user_orgs()));

-- Tenant Write Policies (Protected by private.has_permission)

CREATE POLICY "Auth Insert Invitations" ON public.invitations FOR INSERT WITH CHECK (
    private.has_permission(organization_id, 'manage_invitations') AND private.can_assign_role(organization_id, role_id)
);
CREATE POLICY "Auth Delete Invitations" ON public.invitations FOR DELETE USING (private.has_permission(organization_id, 'manage_invitations'));

CREATE POLICY "Auth Insert Roles" ON public.roles FOR INSERT WITH CHECK (private.has_permission(organization_id, 'manage_roles') AND is_system = false);
CREATE POLICY "Auth Update Roles" ON public.roles FOR UPDATE USING (private.has_permission(organization_id, 'manage_roles') AND is_system = false);
CREATE POLICY "Auth Delete Roles" ON public.roles FOR DELETE USING (private.has_permission(organization_id, 'manage_roles') AND is_system = false);

CREATE POLICY "Auth Insert RolePerms" ON public.role_permissions FOR INSERT WITH CHECK (
    private.has_permission(organization_id, 'manage_roles') AND private.has_permission(organization_id, permission_id) AND
    NOT EXISTS (SELECT 1 FROM public.roles WHERE id = role_id AND is_system = true)
);
CREATE POLICY "Auth Delete RolePerms" ON public.role_permissions FOR DELETE USING (
    private.has_permission(organization_id, 'manage_roles') AND private.has_permission(organization_id, permission_id) AND
    NOT EXISTS (SELECT 1 FROM public.roles WHERE id = role_id AND is_system = true)
);

CREATE POLICY "Auth Insert MemRoles" ON public.membership_roles FOR INSERT WITH CHECK (
    private.has_permission(organization_id, 'manage_team') AND private.can_assign_role(organization_id, role_id)
);
CREATE POLICY "Auth Delete MemRoles" ON public.membership_roles FOR DELETE USING (
    private.has_permission(organization_id, 'manage_team') AND private.can_assign_role(organization_id, role_id)
);

CREATE POLICY "Auth Insert MemBranches" ON public.membership_branches FOR INSERT WITH CHECK (private.has_permission(organization_id, 'manage_team'));
CREATE POLICY "Auth Delete MemBranches" ON public.membership_branches FOR DELETE USING (private.has_permission(organization_id, 'manage_team'));
