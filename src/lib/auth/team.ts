import { randomBytes, createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generate a cryptographically secure 32-byte invitation token and its SHA-256 hash.
 * Only the hash is persisted in the database; the raw token is returned once for the invite link.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}
/**
 * Compute the deterministic SHA-256 hash of a raw invitation token.
 */
export function hashInvitationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

export interface TeamManagerAuthorization {
  authorized: boolean;
  membershipId?: string;
  isOwner?: boolean;
  error?: string;
}

/**
 * Enforce server-side authorization for team management operations.
 * Fails closed: caller must be an active member of organizationId AND either
 * the Primary Owner (is_owner = true) or an Administrator with the 'manage_team' permission.
 */
export async function assertTeamManagerPermission(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<TeamManagerAuthorization> {
  if (!organizationId || !userId) {
    return { authorized: false, error: 'Authentication required.' };
  }

  // 1. Fetch caller membership scoped to organizationId and userId
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !member) {
    return { authorized: false, error: 'Caller does not have a valid membership in this organization.' };
  }

  if (member.status !== 'active') {
    return { authorized: false, error: 'Caller membership is not active in this organization.' };
  }

  // 2. Primary Owner is universally authorized for team management
  if (member.is_owner === true) {
    return {
      authorized: true,
      membershipId: member.id,
      isOwner: true,
    };
  }

  // 3. Check for Administrator role or explicit 'manage_team' permission
  const { data: memRoles } = await supabase
    .from('membership_roles')
    .select('role_id, roles(id, name, is_system)')
    .eq('organization_id', organizationId)
    .eq('membership_id', member.id);

  if (!memRoles || memRoles.length === 0) {
    return {
      authorized: false,
      error: 'Unauthorized: Only the Primary Owner or an Administrator can manage team members.',
    };
  }

  interface RoleItem {
    role_id: string;
    roles: { id?: string; name?: string; is_system?: boolean } | null;
  }
  const roleIds = (memRoles as unknown as RoleItem[]).map((r) => r.role_id);
  const hasAdminRole = (memRoles as unknown as RoleItem[]).some(
    (r) => r.roles?.name === 'Administrator' && r.roles?.is_system === true
  );

  if (hasAdminRole) {
    return {
      authorized: true,
      membershipId: member.id,
      isOwner: false,
    };
  }

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('organization_id', organizationId)
    .in('role_id', roleIds)
    .eq('permission_id', 'manage_team')
    .limit(1);

  if (rolePerms && rolePerms.length > 0) {
    return {
      authorized: true,
      membershipId: member.id,
      isOwner: false,
    };
  }

  return {
    authorized: false,
    error: 'Unauthorized: Only the Primary Owner or an Administrator can manage team members.',
  };
}

/**
 * Log a sensitive team management event into public.audit_logs.
 * Strips any potential secret tokens from the metadata payload.
 */
export async function logTeamAuditEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    // Sanitize metadata to ensure no token or password is ever logged
    const sanitizedMeta = { ...params.metadata };
    delete sanitizedMeta.token;
    delete sanitizedMeta.rawToken;
    delete sanitizedMeta.token_hash;
    delete sanitizedMeta.password;

    await supabase.from('audit_logs').insert({
      organization_id: params.organizationId,
      actor_id: params.actorId || '00000000-0000-0000-0000-000000000000',
      action: params.action,
      resource: `${params.resourceType}:${params.resourceId || 'none'}`,
      payload: sanitizedMeta,
    });
  } catch (err) {
    // Non-blocking log failure in local testing; logged to stderr
    console.error('[AUDIT LOG WARNING] Failed to record team audit log:', err);
  }
}
