import { createClient } from '../supabase/server';

export interface WorkspaceSubscription {
  planName: string;
  price: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  trialEnd: string | null;
  daysRemaining: number;
  isTrialActive: boolean;
}

export interface WorkspaceBranch {
  id: string;
  name: string;
  isAssigned: boolean;
}

export interface WorkspaceRole {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface WorkspaceOperationalData {
  organization: {
    id: string;
    name: string;
    slug: string;
    countryCode: string | null;
    provisioningStatus: string;
    createdAt: string;
  };
  membership: {
    id: string;
    isOwner: boolean;
    status: string;
  };
  subscription: WorkspaceSubscription | null;
  branches: WorkspaceBranch[];
  assignedBranch: WorkspaceBranch | null;
  roles: WorkspaceRole[];
  permissions: string[];
}

/**
 * Calculates the number of whole days remaining in a trial subscription.
 * Returns 0 if expired or not specified.
 */
export function calculateTrialDaysRemaining(
  trialEnd: string | null | undefined,
  nowMs: number = Date.now()
): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd).getTime();
  if (isNaN(end)) return 0;
  const diffMs = end - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retrieves the complete operational state of an authorized tenant workspace under RLS.
 * 
 * Fetches:
 * 1. Active subscription and 7-day trial status.
 * 2. Operating branches and user branch linkage (Headquarters).
 * 3. Assigned roles and permissions under foundational RBAC.
 */
export async function getWorkspaceOperationalData(
  organizationId: string,
  membershipId: string
): Promise<WorkspaceOperationalData | null> {
  const supabase = await createClient();

  // 1. Fetch Organization Details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, country_code, provisioning_status, created_at')
    .eq('id', organizationId)
    .maybeSingle();

  if (orgError || !org) {
    return null;
  }

  // 2. Fetch Membership Record
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('id', membershipId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (memberError || !member) {
    return null;
  }

  // 3. Fetch Subscription & Plan
  const { data: subData } = await supabase
    .from('subscriptions')
    .select('id, status, trial_end, plans(name, price)')
    .eq('organization_id', organizationId)
    .maybeSingle();

  let subscription: WorkspaceSubscription | null = null;
  if (subData) {
    const plan = Array.isArray(subData.plans) ? subData.plans[0] : subData.plans;
    const planName = plan?.name || 'Standard';
    const price = typeof plan?.price === 'number' ? plan.price : 0;
    const daysRemaining = calculateTrialDaysRemaining(subData.trial_end);
    const isTrialActive = subData.status === 'trialing' && daysRemaining > 0;

    subscription = {
      planName,
      price,
      status: subData.status as WorkspaceSubscription['status'],
      trialEnd: subData.trial_end,
      daysRemaining,
      isTrialActive,
    };
  }

  // 4. Fetch Operating Branches & User Assignment
  const { data: branchesData } = await supabase
    .from('branches')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  const { data: memBranchesData } = await supabase
    .from('membership_branches')
    .select('branch_id')
    .eq('organization_id', organizationId)
    .eq('membership_id', membershipId);

  const assignedBranchIds = new Set((memBranchesData || []).map((mb) => mb.branch_id));
  const branches: WorkspaceBranch[] = (branchesData || []).map((b) => ({
    id: b.id,
    name: b.name,
    isAssigned: assignedBranchIds.has(b.id),
  }));

  const assignedBranch = branches.find((b) => b.isAssigned) || branches[0] || null;

  // 5. Fetch Roles & Assigned Permissions
  const { data: memRolesData } = await supabase
    .from('membership_roles')
    .select('role_id, roles(id, name, is_system)')
    .eq('organization_id', organizationId)
    .eq('membership_id', membershipId);

  const roles: WorkspaceRole[] = [];
  if (memRolesData) {
    for (const mr of memRolesData) {
      const r = Array.isArray(mr.roles) ? mr.roles[0] : mr.roles;
      if (r) {
        roles.push({
          id: r.id,
          name: r.name,
          isSystem: r.is_system,
        });
      }
    }
  }

  // 6. Fetch Real Permissions from Database via Assigned Roles
  const roleIds = roles.map((r) => r.id);
  let permissions: string[] = [];
  if (roleIds.length > 0) {
    const { data: rolePermsData } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('organization_id', organizationId)
      .in('role_id', roleIds);

    if (rolePermsData) {
      permissions = Array.from(new Set(rolePermsData.map((rp) => rp.permission_id)));
    }
  }

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      countryCode: org.country_code,
      provisioningStatus: org.provisioning_status,
      createdAt: org.created_at,
    },
    membership: {
      id: member.id,
      isOwner: member.is_owner,
      status: member.status,
    },
    subscription,
    branches,
    assignedBranch,
    roles,
    permissions,
  };
}
