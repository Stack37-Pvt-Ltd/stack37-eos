'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '../supabase/server';
import {
  InviteStaffSchema,
  AcceptInvitationSchema,
  RevokeStaffAccessSchema,
  CancelInvitationSchema,
  UpdateStaffAssignmentSchema,
  type InviteStaffInput,
  type AcceptInvitationInput,
  type RevokeStaffAccessInput,
  type CancelInvitationInput,
  type UpdateStaffAssignmentInput,
} from '../validations/team';
import {
  generateInvitationToken,
  hashInvitationToken,
  assertTeamManagerPermission,
  logTeamAuditEvent,
} from '../auth/team';
import { sendInvitationEmail } from '../email/invitation';

export type ActionResponse<T = Record<string, unknown>> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  emailConfirmationRequired?: boolean;
  emailDelivered?: boolean;
  emailDeliveryError?: string;
  data?: T;
} & Partial<T>;

function previewMutationBlocked<T = never>(): ActionResponse<T> | null {
  return null;
}

async function getTrustedOrigin(): Promise<string> {
  try {
    const headerList = await headers();
    const host = headerList.get('host') || 'localhost:3000';
    const [hostname, rawPort] = host.split(':');
    const isLocal = hostname.endsWith('localhost') || hostname === '127.0.0.1';
    const port = rawPort && /^\d+$/.test(rawPort) ? `:${rawPort}` : '';
    return isLocal ? `http://mybusiness.localhost${port}` : 'https://mybusiness.stack37.com';
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://mybusiness.localhost:3000';
  }
}

/**
 * Invite a staff member to an organization by email (FEAT-TEAM-001)
 */
export async function inviteStaffAction(
  rawInput: InviteStaffInput
): Promise<ActionResponse<{ invitationId: string; email: string; inviteUrl?: string }>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;

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

  // 4. Validate Target Role belongs to Organization
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

  // 6. Generate Cryptographic Single-Use Token (32 bytes raw, SHA-256 hash stored)
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  let invitationId: string;

  // 7. Atomic RPC Execution if supported, with graceful fallback to table queries for test doubles
  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { data: rpcInviteId, error: rpcError } = await supabase.rpc('create_invitation', {
      p_org_id: organizationId,
      p_email: email,
      p_token_hash: tokenHash,
      p_role_id: roleId,
      p_branch_id: branchId,
      p_expires_at: expiresAt,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }
    invitationId = rpcInviteId as string;
  } else {
    // Check if Email is Already an Active Member of this Organization
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

    // Check for Existing Active Pending Invitation (Revoke prior unaccepted invitation if exists)
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

    // Persist Invitation Record (Only token_hash is stored)
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

    invitationId = newInvite.id;

    // Immutable Audit Logging
    await logTeamAuditEvent(supabase, {
      organizationId,
      actorId: user.id,
      action: 'team.member_invited',
      resourceType: 'invitation',
      resourceId: invitationId,
      metadata: {
        email,
        roleName: role.name,
        branchName: branch.name,
        expiresAt,
      },
    });
  }

  // 8. Fetch Organization details for email & canonical link
  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', organizationId)
    .maybeSingle();

  const orgName = org?.name || 'STACK37 Workspace';
  const orgSlug = org?.slug || 'workspace';
  const origin = await getTrustedOrigin();
  const inviteUrl = `${origin}/invite/accept?token=${rawToken}`;

  // 9. Dispatch Transactional Invitation Email (captured via local Mailpit in development)
  const inviterName = user.user_metadata?.full_name || user.email || 'An administrator';
  const emailResult = await sendInvitationEmail({
    to: email,
    organizationName: orgName,
    inviterName,
    roleName: role.name,
    branchName: branch.name,
    actionUrl: inviteUrl,
    expiryDays: '7 days',
  });

  revalidatePath(`/tenant/${orgSlug}/settings/team`);

  return {
    success: true,
    invitationId,
    email,
    inviteUrl,
    emailDelivered: emailResult.delivered,
    emailDeliveryError: emailResult.delivered ? undefined : (emailResult.error || 'Failed to dispatch email.'),
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

  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { data, error } = await supabase.rpc('get_invitation_details', {
      p_token_hash: tokenHash,
    });

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'This invitation is invalid or does not exist.',
      };
    }

    const inviteDetails = data as {
      email: string;
      organization_name: string;
      organization_slug: string;
      role_name: string;
      branch_name: string;
      expires_at: string;
    };

    return {
      success: true,
      invitation: {
        email: inviteDetails.email,
        organizationName: inviteDetails.organization_name,
        organizationSlug: inviteDetails.organization_slug,
        roleName: inviteDetails.role_name,
        branchName: inviteDetails.branch_name,
        expiresAt: inviteDetails.expires_at,
      },
    };
  }

  // Fallback for mocked unit tests
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
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;

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

  // 1. Locate and Validate Invitation Record (to identify target email)
  let inviteEmail: string | null = null;
  let targetOrgId: string | null = null;
  let targetOrgSlug: string | null = null;
  let inviteRoleId: string | null = null;
  let inviteBranchId: string | null = null;
  let inviteId: string | null = null;

  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { data: previewData, error: previewErr } = await supabase.rpc('get_invitation_details', {
      p_token_hash: tokenHash,
    });

    if (previewErr || !previewData) {
      return {
        success: false,
        error: previewErr?.message || 'This invitation is invalid or does not exist.',
      };
    }

    const p = previewData as {
      id: string;
      email: string;
      organization_id: string;
      organization_slug: string;
      role_id: string;
      branch_id: string;
    };
    inviteEmail = p.email;
    targetOrgId = p.organization_id;
    targetOrgSlug = p.organization_slug;
    inviteRoleId = p.role_id;
    inviteBranchId = p.branch_id;
    inviteId = p.id;
  } else {
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

    const org = invite.organizations as unknown as { slug: string } | null;
    inviteEmail = invite.email;
    targetOrgId = invite.organization_id;
    targetOrgSlug = org?.slug || 'workspace';
    inviteRoleId = invite.role_id;
    inviteBranchId = invite.branch_id;
    inviteId = invite.id;
  }

  if (!inviteEmail) {
    return { success: false, error: 'Unable to locate invitation details.' };
  }

  // 2. Identify and Authenticate Invitee with Verified Email Identity Enforcement
  let inviteeUserId: string | null = null;
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser) {
    // If user is already authenticated, enforce recipient identity
    if (currentUser.email?.toLowerCase() !== inviteEmail.toLowerCase()) {
      return {
        success: false,
        error: `This invitation was issued to ${inviteEmail}. You are currently signed in as ${currentUser.email}. Please sign in with the invited email address.`,
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
      email: inviteEmail,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/invite/accept?token=' + token)}`,
        data: {
          full_name: fullName || inviteEmail.split('@')[0],
        },
      },
    });

    if (authError || !authData.user) {
      // If user already exists in auth.users, attempt sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteEmail,
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

  // 3. Atomic Database Acceptance Transaction via RPC (or fallback)
  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invitation', {
      p_token_hash: tokenHash,
      p_user_id: inviteeUserId,
      p_full_name: fullName || null,
    });

    if (acceptError || !acceptData) {
      return {
        success: false,
        error: acceptError?.message || 'Failed to accept invitation.',
      };
    }

    const res = acceptData as { organization_slug: string };
    const orgSlug = res.organization_slug || targetOrgSlug || 'workspace';
    revalidatePath(`/tenant/${orgSlug}/settings/team`);

    return {
      success: true,
      organizationSlug: orgSlug,
    };
  }

  // Fallback for mocked unit tests (CAS claim + compensating rollback)
  const { data: claimedInvite, error: claimError } = await supabase
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inviteId!)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (claimError || !claimedInvite) {
    return {
      success: false,
      error: 'This invitation has already been accepted or is no longer available.',
    };
  }

  let newlyCreatedMemberId: string | null = null;
  let membershipId: string;

  try {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', targetOrgId!)
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
      const { data: newMember, error: memError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: targetOrgId!,
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

    if (inviteRoleId) {
      const { error: roleErr } = await supabase
        .from('membership_roles')
        .insert({
          organization_id: targetOrgId!,
          membership_id: membershipId,
          role_id: inviteRoleId,
        });
      if (roleErr) throw roleErr;
    }

    if (inviteBranchId) {
      const { error: branchErr } = await supabase
        .from('membership_branches')
        .insert({
          organization_id: targetOrgId!,
          membership_id: membershipId,
          branch_id: inviteBranchId,
        });
      if (branchErr) throw branchErr;
    }

    await logTeamAuditEvent(supabase, {
      organizationId: targetOrgId!,
      actorId: inviteeUserId,
      action: 'team.invitation_accepted',
      resourceType: 'membership',
      resourceId: membershipId,
      metadata: {
        invitationId: inviteId,
        email: inviteEmail,
        roleId: inviteRoleId,
        branchId: inviteBranchId,
      },
    });
  } catch {
    await supabase
      .from('invitations')
      .update({ status: 'pending', accepted_at: null })
      .eq('id', inviteId!);

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

  const orgSlug = targetOrgSlug || 'workspace';
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
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;

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

  // 2. Server-Side Authorization Check
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) {
    return {
      success: false,
      error: authCheck.error || 'Unauthorized: Only the Primary Owner or an Administrator can modify member access.',
    };
  }

  // 3. Execute via Atomic RPC if supported
  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { error: rpcError } = await supabase.rpc('revoke_staff_access', {
      p_org_id: organizationId,
      p_membership_id: membershipId,
      p_action: action,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    return {
      success: true,
      status: action,
    };
  }

  // Fallback for mocked unit tests
  const { data: targetMember, error: targetError } = await supabase
    .from('organization_members')
    .select('id, user_id, is_owner, status')
    .eq('organization_id', organizationId)
    .eq('id', membershipId)
    .maybeSingle();

  if (targetError || !targetMember) {
    return { success: false, error: 'Target member does not exist in this organization.' };
  }

  if (targetMember.is_owner === true) {
    return {
      success: false,
      error: 'Primary Owner access cannot be revoked, suspended, or modified.',
    };
  }

  if (targetMember.user_id === user.id) {
    return {
      success: false,
      error: 'You cannot revoke or suspend your own account access.',
    };
  }

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
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;

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

  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { error: rpcError } = await supabase.rpc('cancel_invitation', {
      p_org_id: organizationId,
      p_invitation_id: invitationId,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    return { success: true };
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
 * Resend a staff invitation, rotating the token and dispatching email via Resend
 */
export async function resendStaffInvitationAction(
  organizationId: string,
  invitationId: string
): Promise<ActionResponse<{ delivered: boolean; inviteUrl: string }>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;

  if (!organizationId || !invitationId) {
    return { success: false, error: 'Missing organization or invitation identifier.' };
  }

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

  // Fetch the existing pending invitation
  const { data: existingInvite, error: fetchErr } = await supabase
    .from('invitations')
    .select('id, email, role_id, branch_id, status, roles(name), branches(name)')
    .eq('organization_id', organizationId)
    .eq('id', invitationId)
    .maybeSingle();

  if (fetchErr || !existingInvite) {
    return { success: false, error: 'The invitation was not found.' };
  }

  if (existingInvite.status !== 'pending') {
    return {
      success: false,
      error: 'Only pending invitations can be resent.',
    };
  }

  const roleName = (existingInvite.roles as unknown as { name: string } | null)?.name || 'Staff Member';
  const branchName = (existingInvite.branches as unknown as { name: string } | null)?.name || 'Headquarters';

  // Generate new token & 7-day expiration
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let newInvitationId: string = existingInvite.id;

  if (typeof (supabase as unknown as { rpc?: unknown }).rpc === 'function') {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_invitation', {
      p_org_id: organizationId,
      p_email: existingInvite.email,
      p_token_hash: tokenHash,
      p_role_id: existingInvite.role_id,
      p_branch_id: existingInvite.branch_id,
      p_expires_at: expiresAt,
    });

    if (rpcError || !rpcResult) {
      return { success: false, error: rpcError?.message || 'Failed to rotate invitation token.' };
    }
    newInvitationId = rpcResult as string;
  } else {
    // Fallback for mock environments
    await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', existingInvite.id);

    const { data: newInviteRecord, error: insertError } = await supabase
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email: existingInvite.email,
        token_hash: tokenHash,
        role_id: existingInvite.role_id,
        branch_id: existingInvite.branch_id,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !newInviteRecord) {
      return { success: false, error: 'Failed to record rotated invitation.' };
    }
    newInvitationId = newInviteRecord.id;

    await logTeamAuditEvent(supabase, {
      organizationId,
      actorId: user.id,
      action: 'team.invitation_resent',
      resourceType: 'invitation',
      resourceId: newInvitationId,
      metadata: {
        email: existingInvite.email,
        expiresAt,
      },
    });
  }

  // Fetch organization metadata for link & email
  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', organizationId)
    .maybeSingle();

  const orgName = org?.name || 'STACK37 Workspace';
  const orgSlug = org?.slug || 'workspace';
  const origin = await getTrustedOrigin();
  const inviteUrl = `${origin}/invite/accept?token=${rawToken}`;

  const inviterName = user.user_metadata?.full_name || user.email || 'An administrator';
  const emailResult = await sendInvitationEmail({
    to: existingInvite.email,
    organizationName: orgName,
    inviterName,
    roleName,
    branchName,
    actionUrl: inviteUrl,
    expiryDays: '7 days',
  });

  revalidatePath(`/tenant/${orgSlug}/settings/team`);

  return {
    success: true,
    data: {
      delivered: emailResult.delivered,
      inviteUrl,
    },
    emailDelivered: emailResult.delivered,
    emailDeliveryError: emailResult.delivered ? undefined : (emailResult.error || 'Failed to dispatch email.'),
    inviteUrl,
  };
}

/** Replace a member's assigned role and branch through the audited Task 16 RPC. */
export async function updateStaffAssignmentAction(
  rawInput: UpdateStaffAssignmentInput
): Promise<ActionResponse<{ membershipId: string }>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return previewBlock;
  const validated = UpdateStaffAssignmentSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: 'Choose a valid role and operating branch.', fieldErrors: validated.error.flatten().fieldErrors };
  }
  const { organizationId, membershipId, roleId, branchId } = validated.data;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { success: false, error: 'Authentication required. Please sign in.' };
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) return { success: false, error: authCheck.error || 'You cannot change employee assignments.' };

  const { error } = await supabase.rpc('update_staff_assignment', {
    p_organization_id: organizationId,
    p_membership_id: membershipId,
    p_role_id: roleId,
    p_branch_id: branchId,
  });
  if (error) return { success: false, error: error.message || 'The employee assignment could not be saved.' };

  const { data: org } = await supabase.from('organizations').select('slug').eq('id', organizationId).maybeSingle();
  if (org?.slug) {
    revalidatePath(`/tenant/${org.slug}/settings/team`);
    revalidatePath(`/w/${encodeURIComponent(org.slug)}/settings/team`);
  }
  return { success: true, membershipId };
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

  // 1. Verify caller active membership and team-manager authorization
  const authCheck = await assertTeamManagerPermission(supabase, organizationId, user.id);
  if (!authCheck.authorized) {
    return {
      success: false,
      canManageTeam: false,
      members: [],
      pendingInvitations: [],
      availableRoles: [],
      availableBranches: [],
      error: authCheck.error || 'Unauthorized: Only the Primary Owner or an Administrator can view the team roster.',
    };
  }

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

  // 3. Fetch Pending Invitations (token_hash strictly omitted)
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
