import { requireTenantAccess } from '../../../lib/auth/tenant-guard';

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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              {organization.name} Workspace
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Multi-tenant isolated workspace &bull; Subdomain:{' '}
              <span className="font-mono text-zinc-700">{organization.slug}</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 self-start sm:self-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active Session
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Your Role</p>
          <p className="text-lg font-bold text-zinc-900 mt-1">
            {membership.is_owner ? 'Primary Owner' : 'Team Member'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Membership: {membership.status}</p>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tenant Identity</p>
          <p className="text-lg font-bold text-zinc-900 mt-1 truncate font-mono">{organization.slug}</p>
          <p className="text-xs text-zinc-500 mt-1">RLS Policy Verified</p>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Provisioning</p>
          <p className="text-lg font-bold text-zinc-900 mt-1 capitalize">{organization.provisioning_status}</p>
          <p className="text-xs text-zinc-500 mt-1">EOS Cloud Architecture</p>
        </div>
      </div>
    </div>
  );
}
