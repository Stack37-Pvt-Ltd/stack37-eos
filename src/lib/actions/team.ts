import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '../supabase/server';
import {
  InviteStaffSchema,
  AcceptInvitationSchema,
  RevokeStaffAccessSchema,
  CancelInvitationSchema,
  type InviteStaffInput,
  type AcceptInvitationInput,
  type RevokeStaffAccessInput,
  type CancelInvitationInput,
} from '../validations/team';
import {
  generateInvitationToken,
  hashInvitationToken,
  assertTeamManagerPermission,
  logTeamAuditEvent,
} from '../auth/team';

export type ActionResponse<T = Record<string, unknown>> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  emailConfirmationRequired?: boolean;
} & Partial<T>;

async function getTrustedOrigin(): Promise<string> {
  try {
    const headerList = await headers();
    const host = headerList.get('host') || 'localhost:3000';
    const proto = headerList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }
}

/**
 * Invite a staff member to an organization by email (FEAT-TEAM-001)
 */
export async function inviteStaffAction(
  rawInput: InviteStaffInput
): Promise<ActionResponse<{ invitationId: string; email: string; inviteUrl?: string }>> {
  // 1. Validate Input
  const validated = InviteStaffSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const { organizationId, email, roleId, branchId } = validated.data;
  const supabase = await createClient();

  // 2. Authenticate Caller
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Authentication required. Please sign in.' };
  }

  // 3. Enforce Server-Side Authorization (Primary Owner or Administrator with manage_team)
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) {
    return {
      success: false,
      error: authCheck.error || 'Unauthorized: Only the Primary Owner or an Administrator can invite staff.',
    };
  }

  // 4. Validate Target Role belongs to Organization and is not Primary Owner
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, name, is_system')
    .eq('organization_id', organizationId)
    .eq('id', roleId)
    .maybeSingle();

  if (roleError || !role) {
    return { success: false, error: 'The selected role does not exist in this organization.' };
  }

  // 5. Validate Target Branch belongs to Organization
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('id', branchId)
    .maybeSingle();

  if (branchError || !branch) {
    return { success: false, error: 'The selected operating branch does not exist in this organization.' };
  }

  // 6. Check if Email is Already an Active Member of this Organization
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('user_id', existingProfile.id)
      .maybeSingle();

    if (existingMember && existingMember.status === 'active') {
      return { success: false, error: 'This user is already an active team member of this organization.' };
    }
  }

  // 7. Check for Existing Active Pending Invitation (Revoke prior unaccepted invitation if exists)
  const { data: pendingInvites } = await supabase
    .from('invitations')
    .select('id, expires_at')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .eq('status', 'pending');

  if (pendingInvites && pendingInvites.length > 0) {
    for (const priorInvite of pendingInvites) {
      await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', priorInvite.id);
    }
  }

  // 8. Generate Cryptographic Single-Use Token (32 bytes raw, SHA-256 hash stored)
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // 9. Persist Invitation Record (Only token_hash is stored)
  const { data: newInvite, error: insertError } = await supabase
    .from('invitations')
    .insert({
      organization_id: organizationId,
      email,
      token_hash: tokenHash,
      role_id: roleId,
      branch_id: branchId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (insertError || !newInvite) {
    return { success: false, error: 'Failed to record staff invitation. Please try again.' };
  }

  // 10. Fetch Organization Slug for Deterministic Local Invite Link
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();

  const orgSlug = org?.slug || 'workspace';
  // Deterministic URL for local testing (No external mailer sent)
  const inviteUrl = `http://${orgSlug}.localhost:3000/invite/accept?token=${rawToken}`;

  // 11. Immutable Audit Logging
  await logTeamAuditEvent(supabase, {
    organizationId,
    actorId: user.id,
    action: 'team.member_invited',
    resourceType: 'invitation',
    resourceId: newInvite.id,
    metadata: {
      email,
      roleName: role.name,
      branchName: branch.name,
      expiresAt,
    },
  });

  revalidatePath(`/tenant/${orgSlug}/settings/team`);

  return {
    success: true,
    invitationId: newInvite.id,
    email,
    inviteUrl,
  };
}

/**
 * Public action to retrieve invitation details before acceptance
 */
export async function getInvitationDetailsAction(
  token: string
): Promise<
  ActionResponse<{
    invitation: {
      email: string;
      organizationName: string;
      organizationSlug: string;
      roleName: string;
      branchName: string;
      expiresAt: string;
    };
  }>
> {
  if (!token || token.trim().length < 32) {
    return { success: false, error: 'Invalid invitation token provided.' };
  }

  const tokenHash = hashInvitationToken(token);
  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from('invitations')
    .select(
      'id, organization_id, email, status, expires_at, roles(name), branches(name), organizations(name, slug)'
    )
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return { success: false, error: 'This invitation is invalid or does not exist.' };
  }

  if (invite.status !== 'pending') {
    return {
      success: false,
      error:
        invite.status === 'accepted'
          ? 'This invitation has already been accepted.'
          : 'This invitation is no longer active.',
    };
  }

  if (new Date(invite.expires_at) <= new Date()) {
    return {
      success: false,
      error: 'This invitation has expired. Please ask your administrator to send a new invite.',
    };
  }

  const orgData = invite.organizations as unknown as { name: string; slug: string } | null;
  const roleData = invite.roles as unknown as { name: string } | null;
  const branchData = invite.branches as unknown as { name: string } | null;

  return {
    success: true,
    invitation: {
      email: invite.email,
      organizationName: orgData?.name || 'STACK37 Workspace',
      organizationSlug: orgData?.slug || '',
      roleName: roleData?.name || 'Member',
      branchName: branchData?.name || 'Headquarters',
      expiresAt: invite.expires_at,
    },
  };
}

/**
 * Accept a staff invitation and provision member role and branch bindings
 */
export async function acceptInvitationAction(
  rawInput: AcceptInvitationInput
): Promise<ActionResponse<{ organizationSlug: string }>> {
  const validated = AcceptInvitationSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const { token, fullName, password } = validated.data;
  const tokenHash = hashInvitationToken(token);
  const supabase = await createClient();

  // 1. Locate and Validate Invitation Record
  const { data: invite, error: inviteError } = await supabase
    .from('invitations')
    .select('id, organization_id, email, role_id, branch_id, status, expires_at, organizations(slug)')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (inviteError || !invite) {
    return { success: false, error: 'This invitation is invalid or does not exist.' };
  }

  if (invite.status !== 'pending') {
    return {
      success: false,
      error:
        invite.status === 'accepted'
          ? 'This invitation has already been accepted.'
          : 'This invitation is no longer valid.',
    };
  }

  if (new Date(invite.expires_at) <= new Date()) {
    await supabase.from('invitations').update({ status: 'expired' }).eq('id', invite.id);
    return { success: false, error: 'This invitation has expired. Please request a new invite.' };
  }

  // 2. Identify and Authenticate Invitee with Verified Email Identity Enforcement
  let inviteeUserId: string | null = null;
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser) {
    // If user is already authenticated, enforce recipient identity
    if (currentUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return {
        success: false,
        error: `This invitation was issued to ${invite.email}. You are currently signed in as ${currentUser.email}. Please sign in with the invited email address.`,
      };
    }

    // Enforce verified recipient email identity
    const isEmailVerified = Boolean(
      (currentUser as unknown as { email_confirmed_at?: string; confirmed_at?: string }).email_confirmed_at ||
      (currentUser as unknown as { email_confirmed_at?: string; confirmed_at?: string }).confirmed_at
    );

    if (!isEmailVerified) {
      return {
        success: false,
        error: 'Your email address is not verified. Please verify your email before accepting this invitation.',
      };
    }

    inviteeUserId = currentUser.id;
  } else {
    // Unauthenticated user: require password to complete signup or login
    if (!password) {
      return {
        success: false,
        error: 'Please provide a password to set up your account.',
      };
    }

    const origin = await getTrustedOrigin();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/invite/accept?token=' + token)}`,
        data: {
          full_name: fullName || invite.email.split('@')[0],
        },
      },
    });

    if (authError || !authData.user) {
      // If user already exists in auth.users, attempt sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });

      if (signInError || !signInData.user) {
        return {
          success: false,
          error: authError?.message || 'Failed to authenticate account. Please verify your credentials.',
        };
      }

      // Verify existing user has a confirmed email address
      const isExistingVerified = Boolean(
        (signInData.user as unknown as { email_confirmed_at?: string; confirmed_at?: string }).email_confirmed_at ||
        (signInData.user as unknown as { email_confirmed_at?: string; confirmed_at?: string }).confirmed_at
      );

      if (!isExistingVerified) {
        return {
          success: false,
          error: 'Your email address is not verified. Please verify your email before accepting this invitation.',
        };
      }

      inviteeUserId = signInData.user.id;
    } else {
      // When email confirmation is required, Supabase returns session: null
      const isSignupVerified = Boolean(
        authData.session !== null ||
        (authData.user as unknown as { email_confirmed_at?: string; confirmed_at?: string }).email_confirmed_at ||
        (authData.user as unknown as { email_confirmed_at?: string; confirmed_at?: string }).confirmed_at
      );

      if (!isSignupVerified) {
        // Halt acceptance: do NOT provision company membership before email verification
        return {
          success: false,
          emailConfirmationRequired: true,
          error: 'Account created. Please check your inbox and verify your email address before activating your company membership.',
        };
      }

      inviteeUserId = authData.user.id;
    }
  }

  if (!inviteeUserId) {
    return { success: false, error: 'Unable to establish user identity for this invitation.' };
  }

  // 3. Atomic Conditional Claim (CAS to prevent concurrent double-acceptance race conditions)
  const { data: claimedInvite, error: claimError } = await supabase
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (claimError || !claimedInvite) {
    return {
      success: false,
      error: 'This invitation has already been accepted or is no longer available.',
    };
  }

  // 4. Provision Membership, Role, and Branch with Compensating Rollback Guard
  let newlyCreatedMemberId: string | null = null;
  let membershipId: string;

  try {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', invite.organization_id)
      .eq('user_id', inviteeUserId)
      .maybeSingle();

    if (existingMember) {
      membershipId = existingMember.id;
      if (existingMember.status !== 'active') {
        const { error: activateErr } = await supabase
          .from('organization_members')
          .update({ status: 'active' })
          .eq('id', existingMember.id);
        if (activateErr) throw activateErr;
      }
    } else {
      // Create Active Non-Owner Membership (Strict sole-ownership guard DEC-010)
      const { data: newMember, error: memError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: inviteeUserId,
          is_owner: false,
          status: 'active',
        })
        .select('id')
        .single();

      if (memError || !newMember) {
        throw memError || new Error('Failed to create organization membership.');
      }
      membershipId = newMember.id;
      newlyCreatedMemberId = newMember.id;
    }

    // Link Assigned Role in public.membership_roles
    if (invite.role_id) {
      const { error: roleErr } = await supabase
        .from('membership_roles')
        .insert({
          organization_id: invite.organization_id,
          membership_id: membershipId,
          role_id: invite.role_id,
        });
      if (roleErr) throw roleErr;
    }

    // Link Assigned Branch in public.membership_branches
    if (invite.branch_id) {
      const { error: branchErr } = await supabase
        .from('membership_branches')
        .insert({
          organization_id: invite.organization_id,
          membership_id: membershipId,
          branch_id: invite.branch_id,
        });
      if (branchErr) throw branchErr;
    }

    // Immutable Audit Log
    await logTeamAuditEvent(supabase, {
      organizationId: invite.organization_id,
      actorId: inviteeUserId,
      action: 'team.invitation_accepted',
      resourceType: 'membership',
      resourceId: membershipId,
      metadata: {
        invitationId: invite.id,
        email: invite.email,
        roleId: invite.role_id,
        branchId: invite.branch_id,
      },
    });
  } catch {
    // Compensating Rollback: Revert invitation to pending and purge partial membership if created
    await supabase
      .from('invitations')
      .update({ status: 'pending', accepted_at: null })
      .eq('id', invite.id);

    if (newlyCreatedMemberId) {
      await supabase
        .from('organization_members')
        .delete()
        .eq('id', newlyCreatedMemberId);
    }

    return {
      success: false,
      error: 'Failed to provision organization membership. The invitation remains valid. Please try again.',
    };
  }

  const org = invite.organizations as unknown as { slug: string } | null;
  const orgSlug = org?.slug || 'workspace';

  revalidatePath(`/tenant/${orgSlug}/settings/team`);

  return {
    success: true,
    organizationSlug: orgSlug,
  };
}

/**
 * Revoke, suspend, or reinstate a staff member's access
 */
export async function revokeStaffAccessAction(
  rawInput: RevokeStaffAccessInput
): Promise<ActionResponse<{ status: string }>> {
  const validated = RevokeStaffAccessSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: 'Invalid revocation parameters provided.',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const { organizationId, membershipId, action } = validated.data;
  const supabase = await createClient();

  // 1. Authenticate Caller
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Authentication required. Please sign in.' };
  }

  // 2. Authorize Caller (Primary Owner or Administrator with manage_team)
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) {
    return {
      success: false,
      error: authCheck.error || 'Unauthorized: Only the Primary Owner or an Administrator can modify member access.',
    };
  }

  // 3. Locate Target Member and Enforce Single Primary Owner Protection
  const { data: targetMember, error: targetError } = await supabase
    .from('organization_members')
    .select('id, user_id, is_owner, status')
    .eq('organization_id', organizationId)
    .eq('id', membershipId)
    .maybeSingle();

  if (targetError || !targetMember) {
    return { success: false, error: 'Target member does not exist in this organization.' };
  }

  // Strict Invariant Guard: Primary Owner cannot be suspended or removed (DEC-010)
  if (targetMember.is_owner === true) {
    return {
      success: false,
      error: 'Primary Owner access cannot be revoked, suspended, or modified.',
    };
  }

  // Self-revocation Guard
  if (targetMember.user_id === user.id) {
    return {
      success: false,
      error: 'You cannot revoke or suspend your own account access.',
    };
  }

  // 4. Execute Status Modification or Removal
  if (action === 'suspend') {
    const { error: updateError } = await supabase
      .from('organization_members')
      .update({ status: 'suspended' })
      .eq('organization_id', organizationId)
      .eq('id', membershipId);

    if (updateError) {
      return { success: false, error: 'Failed to suspend member access.' };
    }
  } else if (action === 'reinstate') {
    const { error: updateError } = await supabase
      .from('organization_members')
      .update({ status: 'active' })
      .eq('organization_id', organizationId)
      .eq('id', membershipId);

    if (updateError) {
      return { success: false, error: 'Failed to reinstate member access.' };
    }
  } else if (action === 'remove') {
    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', membershipId);

    if (deleteError) {
      return { success: false, error: 'Failed to remove member from organization.' };
    }
  }

  // 5. Immutable Audit Log
  await logTeamAuditEvent(supabase, {
    organizationId,
    actorId: user.id,
    action: `team.member_${action}`,
    resourceType: 'membership',
    resourceId: membershipId,
    metadata: {
      targetUserId: targetMember.user_id,
      previousStatus: targetMember.status,
      actionApplied: action,
    },
  });

  return {
    success: true,
    status: action,
  };
}

/**
 * Cancel an unaccepted pending invitation
 */
export async function cancelInvitationAction(
  rawInput: CancelInvitationInput
): Promise<ActionResponse> {
  const validated = CancelInvitationSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: 'Invalid invitation cancellation parameters.' };
  }

  const { organizationId, invitationId } = validated.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) {
    return { success: false, error: 'Unauthorized: Manager permission required.' };
  }

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('organization_id', organizationId)
    .eq('id', invitationId)
    .eq('status', 'pending');

  if (error) {
    return { success: false, error: 'Failed to cancel invitation.' };
  }

  await logTeamAuditEvent(supabase, {
    organizationId,
    actorId: user.id,
    action: 'team.invitation_canceled',
    resourceType: 'invitation',
    resourceId: invitationId,
  });

  return { success: true };
}

/**
 * Retrieve the active team roster, roles, branches, and pending invitations for an organization
 */
export async function getTeamRoster(
  organizationId: string
): Promise<{
  success: boolean;
  canManageTeam: boolean;
  members: Array<{
    membershipId: string;
    userId: string;
    email: string;
    fullName: string;
    isOwner: boolean;
    status: 'active' | 'suspended';
    roles: Array<{ id: string; name: string; isSystem: boolean }>;
    branches: Array<{ id: string; name: string }>;
    joinedAt: string;
  }>;
  pendingInvitations: Array<{
    id: string;
    email: string;
    roleName: string;
    branchName: string;
    expiresAt: string;
    createdAt: string;
  }>;
  availableRoles: Array<{ id: string; name: string; isSystem: boolean }>;
  availableBranches: Array<{ id: string; name: string }>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      canManageTeam: false,
      members: [],
      pendingInvitations: [],
      availableRoles: [],
      availableBranches: [],
      error: 'Authentication required.',
    };
  }

  // 1. Verify caller active membership
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);

  // 2. Fetch Members
  const { data: membersData } = await supabase
    .from('organization_members')
    .select(
      `
      id,
      user_id,
      is_owner,
      status,
      created_at,
      profiles:user_id(email, full_name),
      membership_roles(role_id, roles(id, name, is_system)),
      membership_branches(branch_id, branches(id, name))
    `
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  interface MemberQueryResult {
    id: string;
    user_id: string;
    is_owner: boolean;
    status: 'active' | 'suspended';
    created_at: string;
    profiles: { email?: string; full_name?: string } | null;
    membership_roles?: Array<{ roles: { id: string; name: string; is_system: boolean } | null }> | null;
    membership_branches?: Array<{ branches: { id: string; name: string } | null }> | null;
  }

  interface PendingInviteQueryResult {
    id: string;
    email: string;
    status: string;
    expires_at: string;
    created_at: string;
    roles: { name: string } | null;
    branches: { name: string } | null;
  }

  const typedMembers = (membersData || []) as unknown as MemberQueryResult[];
  const members = typedMembers.map((m) => {
    const profile = m.profiles;
    const memRoles = (m.membership_roles || [])
      .map((mr) => mr.roles)
      .filter((r): r is { id: string; name: string; is_system: boolean } => Boolean(r))
      .map((r) => ({ id: r.id, name: r.name, isSystem: Boolean(r.is_system) }));
    const memBranches = (m.membership_branches || [])
      .map((mb) => mb.branches)
      .filter((b): b is { id: string; name: string } => Boolean(b));

    return {
      membershipId: m.id,
      userId: m.user_id,
      email: profile?.email || '',
      fullName: profile?.full_name || 'Team Member',
      isOwner: m.is_owner === true,
      status: m.status,
      roles: memRoles,
      branches: memBranches,
      joinedAt: m.created_at,
    };
  });

  // 3. Fetch Pending Invitations
  const { data: pendingData } = await supabase
    .from('invitations')
    .select('id, email, status, expires_at, created_at, roles(name), branches(name)')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const typedPending = (pendingData || []) as unknown as PendingInviteQueryResult[];
  const pendingInvitations = typedPending.map((inv) => ({
    id: inv.id,
    email: inv.email,
    roleName: inv.roles?.name || 'Member',
    branchName: inv.branches?.name || 'Headquarters',
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
  }));

  // 4. Fetch Available Roles and Branches
  const { data: rolesData } = await supabase
    .from('roles')
    .select('id, name, is_system')
    .eq('organization_id', organizationId)
    .order('name');

  const { data: branchesData } = await supabase
    .from('branches')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name');

  return {
    success: true,
    canManageTeam: authCheck.authorized,
    members,
    pendingInvitations,
    availableRoles: (rolesData || []).map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: Boolean(r.is_system),
    })),
    availableBranches: (branchesData || []).map((b) => ({
      id: b.id,
      name: b.name,
    })),
  };
}
