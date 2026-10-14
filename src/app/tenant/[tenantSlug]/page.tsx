import { WorkspaceOverview } from '../../../components/tenant/workspace-overview';
import { requireTenantAccess } from '../../../lib/auth/tenant-guard';
import { getWorkspaceOperationalData } from '../../../lib/auth/workspace-context';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TenantPage(props: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const params = await props.params;
  const access = await requireTenantAccess(params.tenantSlug);

  if (!access.authorized) {
    return null; // TenantLayout renders TenantAccessDenied
  }

  const { organization, membership } = access.context;
  const operationalData = await getWorkspaceOperationalData(organization.id, membership.id);

  return <WorkspaceOverview organization={organization} membership={membership} data={operationalData} />;
}
