import { createClient } from '../supabase/server';
import { redirect } from 'next/navigation';
import { sanitizeRedirectPath } from '../validations/auth';

import { UserOrganization, getTenantWorkspaceUrl } from './tenant-utils';

export type { UserOrganization };
export { getTenantWorkspaceUrl };

export interface TenantAccessContext {
  user: {
    id: string;
    email?: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    provisioning_status: string;
  };
  membership: {
    id: string;
    is_owner: boolean;
    status: string;
  };
}

export type TenantAccessResult =
  | { authorized: true; context: TenantAccessContext }
  | { authorized: false; reason: 'unauthenticated'; redirectUrl: string }
  | { authorized: false; reason: 'not_a_member'; user: { id: string; email?: string } }
  | { authorized: false; reason: 'suspended'; user: { id: string; email?: string }; organizationName?: string };

/**
 * Retrieves all organizations where the currently authenticated user has an active membership.
 * Relies strictly on RLS-enforced queries (private.get_user_orgs() requires status = 'active').
 * Suspended memberships and unauthorized organizations are automatically excluded by PostgreSQL RLS.
 */
export async function getUserOrganizations(): Promise<UserOrganization[]> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  // 1. Fetch authorized organizations visible to this user under RLS
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, slug, provisioning_status')
    .order('name', { ascending: true });

  if (orgsError || !orgs || orgs.length === 0) {
    return [];
  }

  // 2. Fetch corresponding active memberships for role/owner metadata
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, is_owner, status')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const membershipMap = new Map((memberships || []).map((m) => [m.organization_id, m]));

  return orgs.map((org) => {
    const mem = membershipMap.get(org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      provisioning_status: org.provisioning_status,
      is_owner: mem?.is_owner ?? false,
      status: mem?.status ?? 'active',
    };
  });
}

/**
 * Server-side guard verifying whether the current user is authorized to access a given tenant slug.
 * 
 * Invariants:
 * 1. Unauthenticated users are flagged for login redirection with a sanitized return path.
 * 2. Tenant membership and status are verified via RLS-respecting queries.
 * 3. Suspended employees are strictly blocked from entering company workspaces.
 * 4. Users belonging to multiple organizations are authorized only for organizations they actively belong to.
 */
export async function verifyTenantAccess(
  tenantSlug: string,
  returnPath = '/'
): Promise<TenantAccessResult> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    const safeReturn = sanitizeRedirectPath(returnPath, '/');
    return {
      authorized: false,
      reason: 'unauthenticated',
      redirectUrl: `/login?next=${encodeURIComponent(safeReturn)}`,
    };
  }

  const sanitizedSlug = tenantSlug?.trim().toLowerCase();
  if (!sanitizedSlug) {
    return {
      authorized: false,
      reason: 'not_a_member',
      user: { id: user.id, email: user.email },
    };
  }

  // Query organization under RLS (Tenant Read Orgs allows active members only)
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, provisioning_status')
    .eq('slug', sanitizedSlug)
    .maybeSingle();

  if (orgError || !org) {
    return {
      authorized: false,
      reason: 'not_a_member',
      user: { id: user.id, email: user.email },
    };
  }

  // Query user's specific membership record in this organization
  const { data: membership, error: memError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memError || !membership) {
    return {
      authorized: false,
      reason: 'not_a_member',
      user: { id: user.id, email: user.email },
    };
  }

  // Prevent suspended employees from entering company workspaces
  if (membership.status !== 'active') {
    return {
      authorized: false,
      reason: 'suspended',
      user: { id: user.id, email: user.email },
      organizationName: org.name,
    };
  }

  return {
    authorized: true,
    context: {
      user: { id: user.id, email: user.email },
      organization: org,
      membership,
    },
  };
}

/**
 * Convenient wrapper for Server Components.
 * Automatically performs Next.js redirect if unauthenticated, or returns TenantAccessResult.
 */
export async function requireTenantAccess(
  tenantSlug: string,
  currentPath = '/'
): Promise<TenantAccessResult> {
  const result = await verifyTenantAccess(tenantSlug, currentPath);

  if (!result.authorized && result.reason === 'unauthenticated') {
    redirect(result.redirectUrl);
  }

  return result;
}
