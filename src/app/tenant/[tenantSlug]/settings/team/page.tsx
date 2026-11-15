import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { requireTenantAccess } from '../../../../../lib/auth/tenant-guard';
import {
  cancelInvitationAction,
  getTeamRoster,
  inviteStaffAction,
  revokeStaffAccessAction,
  updateStaffAssignmentAction,
} from '../../../../../lib/actions/team';
import { TeamManagement } from '../../../../../components/tenant/team-management';

export const metadata: Metadata = {
  title: 'Team — My Business by STACK37',
  description: 'Manage employee access to your business workspace.',
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamSettingsPage(props: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await props.params;
  const teamRoutePath = `/w/${encodeURIComponent(tenantSlug)}/settings/team`;
  const returnPath = teamRoutePath;
  const access = await requireTenantAccess(tenantSlug, returnPath);
  if (!access.authorized) return null;

  const { organization } = access.context;
  const result = await getTeamRoster(organization.id);
  const roster = result.success ? {
    canManageTeam: result.canManageTeam,
    members: result.members,
    pendingInvitations: result.pendingInvitations,
    availableRoles: result.availableRoles,
    availableBranches: result.availableBranches,
  } : null;

  async function invite(input: { email: string; roleId: string; branchId: string }) {
    'use server';
    if (process.env.VERCEL_ENV === 'preview') {
      return { success: false, error: 'Invitations are disabled in Preview to protect shared live business data.' };
    }
    const currentAccess = await requireTenantAccess(tenantSlug, returnPath);
    if (!currentAccess.authorized) return { success: false, error: 'Workspace access could not be verified.' };

    const response = await inviteStaffAction({ organizationId: currentAccess.context.organization.id, ...input });
    if (response.success) revalidatePath(teamRoutePath);
    return {
      success: response.success,
      error: response.error,
      invitationId: response.invitationId,
      email: response.email,
      inviteUrl: response.inviteUrl,
      emailDelivered: response.emailDelivered,
      emailDeliveryError: response.emailDeliveryError,
    };
  }

  async function updateMember(input: { membershipId: string; action: 'suspend' | 'reinstate' | 'remove' }) {
    'use server';
    if (process.env.VERCEL_ENV === 'preview') return { success: false, error: 'Team changes are disabled in Preview to protect shared live business data.' };
    const currentAccess = await requireTenantAccess(tenantSlug, returnPath);
    if (!currentAccess.authorized) return { success: false, error: 'Workspace access could not be verified.' };
    const response = await revokeStaffAccessAction({ organizationId: currentAccess.context.organization.id, ...input });
    if (response.success) revalidatePath(teamRoutePath);
    return response;
  }

  async function cancelInvitation(input: { invitationId: string }) {
    'use server';
    if (process.env.VERCEL_ENV === 'preview') return { success: false, error: 'Team changes are disabled in Preview to protect shared live business data.' };
    const currentAccess = await requireTenantAccess(tenantSlug, returnPath);
    if (!currentAccess.authorized) return { success: false, error: 'Workspace access could not be verified.' };
    const response = await cancelInvitationAction({ organizationId: currentAccess.context.organization.id, ...input });
    if (response.success) revalidatePath(teamRoutePath);
    return response;
  }

  async function updateAssignment(input: { membershipId: string; roleId: string; branchId: string }) {
    'use server';
    if (process.env.VERCEL_ENV === 'preview') return { success: false, error: 'Team changes are disabled in Preview to protect shared live business data.' };
    const currentAccess = await requireTenantAccess(tenantSlug, returnPath);
    if (!currentAccess.authorized) return { success: false, error: 'Workspace access could not be verified.' };
    const response = await updateStaffAssignmentAction({ organizationId: currentAccess.context.organization.id, ...input });
    if (response.success) revalidatePath(teamRoutePath);
    return response;
  }

  return <div className="space-y-6">
    <TeamManagement
      organizationName={organization.name}
      roster={roster}
      rosterError={result.success ? undefined : result.error}
      previewReadOnly={process.env.VERCEL_ENV === 'preview'}
      actions={{
        invite,
        updateMember,
        cancelInvitation,
        updateAssignment,
      }}
    />
  </div>;
}
