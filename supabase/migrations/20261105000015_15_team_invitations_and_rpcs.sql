-- 15. Team Invitations, Role/Branch Assignment & Security Definer RPCs
-- Tasks: TASK-TEAM-001 (FEAT-TEAM-001), TASK-UK-SUPER-004

-- 1. Reference Data: Ensure 'manage_invitations' permission exists
INSERT INTO public.permissions (id, module_name, action)
VALUES ('manage_invitations', 'core', 'manage_invitations')
ON CONFLICT (id) DO NOTHING;

-- Map 'manage_invitations' to all existing system Administrator roles
INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, 'manage_invitations'
FROM public.roles r
WHERE r.name = 'Administrator' AND r.is_system = true
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- 2. Update private.provision_workspace_defaults to include manage_invitations for new organizations
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
    -- 1. Locate primary owner membership
    SELECT id INTO v_owner_mem_id
    FROM public.organization_members
    WHERE organization_id = p_org_id AND is_owner = true
    LIMIT 1;

    IF v_owner_mem_id IS NULL THEN
        RAISE EXCEPTION 'Cannot provision workspace defaults: Primary owner membership not found for org %', p_org_id;
    END IF;

    -- 2. Ensure default Headquarters branch exists
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

    -- 3. Link primary owner to Headquarters branch
    INSERT INTO public.membership_branches (organization_id, membership_id, branch_id)
    VALUES (p_org_id, v_owner_mem_id, v_branch_id)
    ON CONFLICT (organization_id, membership_id, branch_id) DO NOTHING;

    -- 4. Ensure foundational roles exist
    INSERT INTO public.roles (organization_id, name, is_system)
    VALUES (p_org_id, 'Administrator', true)
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_admin_role_id;

    IF v_admin_role_id IS NULL THEN
        SELECT id INTO v_admin_role_id
        FROM public.roles
        WHERE organization_id = p_org_id AND name = 'Administrator';
    END IF;

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
    INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
    SELECT p_org_id, v_admin_role_id, p.id
    FROM public.permissions p
    WHERE p.id IN ('manage_team', 'manage_invitations', 'audit:read')
    ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

    -- 6. Assign primary owner to Administrator role
    INSERT INTO public.membership_roles (organization_id, membership_id, role_id)
    VALUES (p_org_id, v_owner_mem_id, v_admin_role_id)
    ON CONFLICT (organization_id, membership_id, role_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.provision_workspace_defaults(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.provision_workspace_defaults(UUID) TO postgres, service_role;

-- 3. Hardened Table Grants and Policy Cleanup (RPC-Only Mutation Boundary for Members & Invitations)
-- Direct client INSERT, UPDATE, DELETE on organization_members and invitations are strictly revoked.
-- All member and invitation mutations must execute exclusively through audited SECURITY DEFINER RPCs.
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM public, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invitations FROM public, anon, authenticated;

-- Ensure SELECT grants remain active for authenticated tenant reads
GRANT SELECT ON public.organization_members TO authenticated;
GRANT SELECT (id, organization_id, email, role_id, branch_id, status, expires_at, accepted_at, created_at) ON public.invitations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.membership_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.membership_branches TO authenticated;

-- Drop direct write policies on organization_members and invitations
DROP POLICY IF EXISTS "Auth Update Members" ON public.organization_members;
DROP POLICY IF EXISTS "Auth Delete Members" ON public.organization_members;
DROP POLICY IF EXISTS "Auth Insert Invitations" ON public.invitations;
DROP POLICY IF EXISTS "Auth Update Invitations" ON public.invitations;
DROP POLICY IF EXISTS "Auth Delete Invitations" ON public.invitations;

-- Ensure membership_roles policies strictly enforce can_assign_role (privilege escalation guard)
DROP POLICY IF EXISTS "Auth Insert MemRoles" ON public.membership_roles;
CREATE POLICY "Auth Insert MemRoles" ON public.membership_roles FOR INSERT WITH CHECK (
    private.has_permission(organization_id, 'manage_team') AND private.can_assign_role(organization_id, role_id)
);

DROP POLICY IF EXISTS "Auth Delete MemRoles" ON public.membership_roles;
CREATE POLICY "Auth Delete MemRoles" ON public.membership_roles FOR DELETE USING (
    private.has_permission(organization_id, 'manage_team') AND private.can_assign_role(organization_id, role_id)
);

DROP POLICY IF EXISTS "Auth Insert MemBranches" ON public.membership_branches;
CREATE POLICY "Auth Insert MemBranches" ON public.membership_branches FOR INSERT WITH CHECK (
    private.has_permission(organization_id, 'manage_team')
);

DROP POLICY IF EXISTS "Auth Delete MemBranches" ON public.membership_branches;
CREATE POLICY "Auth Delete MemBranches" ON public.membership_branches FOR DELETE USING (
    private.has_permission(organization_id, 'manage_team')
);

-- 4. SECURITY DEFINER RPC: create_invitation
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_org_id UUID,
    p_email TEXT,
    p_token_hash TEXT,
    p_role_id UUID,
    p_branch_id UUID,
    p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_invite_id UUID;
    v_role_exists BOOLEAN;
    v_branch_exists BOOLEAN;
    v_already_member BOOLEAN;
    v_clean_email TEXT := lower(trim(p_email));
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Please sign in.';
    END IF;

    -- Check caller authorization: Primary Owner or manage_team / manage_invitations
    IF NOT (
        private.has_permission(p_org_id, 'manage_team') OR
        private.has_permission(p_org_id, 'manage_invitations')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the Primary Owner or an Administrator can invite staff.';
    END IF;

    -- Validate role belongs to target organization
    SELECT EXISTS (
        SELECT 1 FROM public.roles WHERE organization_id = p_org_id AND id = p_role_id
    ) INTO v_role_exists;

    IF NOT v_role_exists THEN
        RAISE EXCEPTION 'The selected role does not exist in this organization.';
    END IF;

    -- Enforce role privilege assignment protection (owners can assign system roles; non-owners cannot)
    IF NOT private.can_assign_role(p_org_id, p_role_id) THEN
        RAISE EXCEPTION 'Caller cannot assign the requested role due to privilege constraints.';
    END IF;

    -- Validate branch belongs to target organization
    SELECT EXISTS (
        SELECT 1 FROM public.branches WHERE organization_id = p_org_id AND id = p_branch_id
    ) INTO v_branch_exists;

    IF NOT v_branch_exists THEN
        RAISE EXCEPTION 'The selected operating branch does not exist in this organization.';
    END IF;

    -- Validate recipient is not already an active member of this organization
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = p_org_id
          AND lower(p.email) = v_clean_email
          AND om.status = 'active'
    ) INTO v_already_member;

    IF v_already_member THEN
        RAISE EXCEPTION 'This user is already an active team member of this organization.';
    END IF;

    -- Rotate existing pending invitation for same (org, email)
    UPDATE public.invitations
    SET status = 'revoked'
    WHERE organization_id = p_org_id
      AND lower(email) = v_clean_email
      AND status = 'pending';

    -- Insert new invitation
    INSERT INTO public.invitations (
        organization_id,
        email,
        token_hash,
        role_id,
        branch_id,
        status,
        expires_at
    )
    VALUES (
        p_org_id,
        v_clean_email,
        p_token_hash,
        p_role_id,
        p_branch_id,
        'pending',
        p_expires_at
    )
    RETURNING id INTO v_invite_id;

    -- Immutable Audit Log
    PERFORM private.insert_audit_log(
        p_org_id,
        'team.member_invited',
        'invitations',
        jsonb_build_object(
            'invitation_id', v_invite_id,
            'email', v_clean_email,
            'role_id', p_role_id,
            'branch_id', p_branch_id,
            'expires_at', p_expires_at
        )
    );

    RETURN v_invite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- 5. SECURITY DEFINER RPC: get_invitation_details
CREATE OR REPLACE FUNCTION public.get_invitation_details(
    p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 32 THEN
        RAISE EXCEPTION 'Invalid invitation token provided.';
    END IF;

    SELECT
        i.id,
        i.organization_id,
        i.email,
        i.status,
        i.expires_at,
        i.role_id,
        i.branch_id,
        o.name AS organization_name,
        o.slug AS organization_slug,
        COALESCE(r.name, 'Member') AS role_name,
        COALESCE(b.name, 'Headquarters') AS branch_name
    INTO v_invite
    FROM public.invitations i
    JOIN public.organizations o ON o.id = i.organization_id
    LEFT JOIN public.roles r ON r.id = i.role_id AND r.organization_id = i.organization_id
    LEFT JOIN public.branches b ON b.id = i.branch_id AND b.organization_id = i.organization_id
    WHERE i.token_hash = trim(p_token_hash);

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'This invitation is invalid or does not exist.';
    END IF;

    IF v_invite.status = 'accepted' THEN
        RAISE EXCEPTION 'This invitation has already been accepted.';
    END IF;

    IF v_invite.status != 'pending' THEN
        RAISE EXCEPTION 'This invitation is no longer active.';
    END IF;

    IF v_invite.expires_at <= now() THEN
        RAISE EXCEPTION 'This invitation has expired. Please ask your administrator to send a new invite.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_invite.id,
        'email', v_invite.email,
        'organization_id', v_invite.organization_id,
        'organization_name', v_invite.organization_name,
        'organization_slug', v_invite.organization_slug,
        'role_id', v_invite.role_id,
        'role_name', v_invite.role_name,
        'branch_id', v_invite.branch_id,
        'branch_name', v_invite.branch_name,
        'expires_at', v_invite.expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_details(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_details(TEXT) TO anon, authenticated, service_role;

-- 6. SECURITY DEFINER RPC: accept_invitation (Atomic ACID Acceptance)
CREATE OR REPLACE FUNCTION public.accept_invitation(
    p_token_hash TEXT,
    p_user_id UUID,
    p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_invite RECORD;
    v_auth_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_confirmed_at TIMESTAMPTZ;
    v_mem_id UUID;
    v_mem_status TEXT;
    v_slug TEXT;
BEGIN
    IF v_caller_id IS NULL OR v_caller_id != p_user_id THEN
        RAISE EXCEPTION 'Authentication required: caller identity does not match acceptance user.';
    END IF;

    -- Atomically locate and lock invitation row
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE token_hash = trim(p_token_hash)
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'This invitation is invalid or does not exist.';
    END IF;

    IF v_invite.status = 'accepted' THEN
        RAISE EXCEPTION 'This invitation has already been accepted.';
    END IF;

    IF v_invite.status != 'pending' THEN
        RAISE EXCEPTION 'This invitation is no longer valid.';
    END IF;

    IF v_invite.expires_at <= now() THEN
        RAISE EXCEPTION 'This invitation has expired. Please request a new invite.';
    END IF;

    -- Verify authenticated user identity and confirmed status
    SELECT email, email_confirmed_at, confirmed_at
    INTO v_auth_email, v_email_confirmed_at, v_confirmed_at
    FROM auth.users
    WHERE id = p_user_id;

    IF v_auth_email IS NULL THEN
        RAISE EXCEPTION 'User account not found.';
    END IF;

    IF lower(trim(v_auth_email)) != lower(trim(v_invite.email)) THEN
        RAISE EXCEPTION 'This invitation was issued to %, but you are signed in as %.', v_invite.email, v_auth_email;
    END IF;

    IF v_email_confirmed_at IS NULL AND v_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Your email address is not verified. Please verify your email before accepting this invitation.';
    END IF;

    -- Atomically claim invitation
    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;

    -- Locate existing membership or insert new
    SELECT id, status INTO v_mem_id, v_mem_status
    FROM public.organization_members
    WHERE organization_id = v_invite.organization_id AND user_id = p_user_id
    FOR UPDATE;

    IF v_mem_id IS NOT NULL THEN
        IF v_mem_status != 'active' THEN
            UPDATE public.organization_members SET status = 'active' WHERE id = v_mem_id;
        END IF;
    ELSE
        -- Strict sole-ownership invariant DEC-010: is_owner = false
        INSERT INTO public.organization_members (
            organization_id,
            user_id,
            is_owner,
            status
        )
        VALUES (
            v_invite.organization_id,
            p_user_id,
            false,
            'active'
        )
        RETURNING id INTO v_mem_id;
    END IF;

    -- Update profile full_name if provided and unset
    IF p_full_name IS NOT NULL AND length(trim(p_full_name)) > 0 THEN
        UPDATE public.profiles
        SET full_name = trim(p_full_name)
        WHERE id = p_user_id AND (full_name IS NULL OR full_name = '' OR full_name = split_part(v_auth_email, '@', 1));
    END IF;

    -- Provision assigned role
    IF v_invite.role_id IS NOT NULL THEN
        INSERT INTO public.membership_roles (organization_id, membership_id, role_id)
        VALUES (v_invite.organization_id, v_mem_id, v_invite.role_id)
        ON CONFLICT (organization_id, membership_id, role_id) DO NOTHING;
    END IF;

    -- Provision assigned branch
    IF v_invite.branch_id IS NOT NULL THEN
        INSERT INTO public.membership_branches (organization_id, membership_id, branch_id)
        VALUES (v_invite.organization_id, v_mem_id, v_invite.branch_id)
        ON CONFLICT (organization_id, membership_id, branch_id) DO NOTHING;
    END IF;

    -- Audit Log
    PERFORM private.insert_audit_log(
        v_invite.organization_id,
        'team.invitation_accepted',
        'memberships',
        jsonb_build_object(
            'invitation_id', v_invite.id,
            'membership_id', v_mem_id,
            'email', v_invite.email,
            'role_id', v_invite.role_id,
            'branch_id', v_invite.branch_id
        )
    );

    SELECT slug INTO v_slug FROM public.organizations WHERE id = v_invite.organization_id;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_invite.organization_id,
        'organization_slug', COALESCE(v_slug, 'workspace'),
        'membership_id', v_mem_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT) TO authenticated, service_role;

-- 7. SECURITY DEFINER RPC: revoke_staff_access (Suspend, Reinstate, Remove)
CREATE OR REPLACE FUNCTION public.revoke_staff_access(
    p_org_id UUID,
    p_membership_id UUID,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_target_user_id UUID;
    v_is_owner BOOLEAN;
    v_target_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Please sign in.';
    END IF;

    IF NOT (
        private.has_permission(p_org_id, 'manage_team') OR
        private.has_permission(p_org_id, 'manage_invitations')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the Primary Owner or an Administrator can modify member access.';
    END IF;

    -- Lock target member
    SELECT user_id, is_owner, status
    INTO v_target_user_id, v_is_owner, v_target_status
    FROM public.organization_members
    WHERE organization_id = p_org_id AND id = p_membership_id
    FOR UPDATE;

    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'Target member does not exist in this organization.';
    END IF;

    -- Strict Invariant Guard: Primary Owner cannot be suspended or removed (DEC-010)
    IF v_is_owner = true THEN
        RAISE EXCEPTION 'Primary Owner access cannot be revoked, suspended, or modified.';
    END IF;

    -- Self-revocation Guard
    IF v_target_user_id = v_caller_id THEN
        RAISE EXCEPTION 'You cannot revoke or suspend your own account access.';
    END IF;

    IF p_action = 'suspend' THEN
        UPDATE public.organization_members SET status = 'suspended' WHERE id = p_membership_id;
    ELSIF p_action = 'reinstate' THEN
        UPDATE public.organization_members SET status = 'active' WHERE id = p_membership_id;
    ELSIF p_action = 'remove' THEN
        DELETE FROM public.organization_members WHERE id = p_membership_id;
    ELSE
        RAISE EXCEPTION 'Invalid revocation action: %. Must be suspend, reinstate, or remove.', p_action;
    END IF;

    -- Audit Log
    PERFORM private.insert_audit_log(
        p_org_id,
        'team.member_' || p_action,
        'memberships',
        jsonb_build_object(
            'membership_id', p_membership_id,
            'target_user_id', v_target_user_id,
            'action', p_action
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', p_action
    );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_staff_access(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_staff_access(UUID, UUID, TEXT) TO authenticated, service_role;

-- 8. SECURITY DEFINER RPC: cancel_invitation
CREATE OR REPLACE FUNCTION public.cancel_invitation(
    p_org_id UUID,
    p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Please sign in.';
    END IF;

    IF NOT (
        private.has_permission(p_org_id, 'manage_team') OR
        private.has_permission(p_org_id, 'manage_invitations')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Manager permission required.';
    END IF;

    UPDATE public.invitations
    SET status = 'revoked'
    WHERE organization_id = p_org_id
      AND id = p_invitation_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or cannot be canceled.';
    END IF;

    PERFORM private.insert_audit_log(
        p_org_id,
        'team.invitation_canceled',
        'invitations',
        jsonb_build_object('invitation_id', p_invitation_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_invitation(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invitation(UUID, UUID) TO authenticated, service_role;
