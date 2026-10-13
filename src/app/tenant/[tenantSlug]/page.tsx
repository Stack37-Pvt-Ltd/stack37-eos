import Link from 'next/link';
import { requireTenantAccess } from '../../../lib/auth/tenant-guard';
import { getWorkspaceOperationalData } from '../../../lib/auth/workspace-context';
import {
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

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

  const subscription = operationalData?.subscription;
  const branch = operationalData?.assignedBranch;
  const primaryRole = operationalData?.roles[0]?.name || (membership.is_owner ? 'Primary Owner' : 'Team Member');

  const trialDaysRemaining = subscription?.daysRemaining ?? 7;
  const isTrialActive = subscription?.isTrialActive ?? true;

  return (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
                {organization.name}
              </h1>
              {operationalData?.organization.countryCode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {operationalData.organization.countryCode}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Multi-tenant isolated workspace &bull; Subdomain:{' '}
              <span className="font-mono font-medium text-zinc-700">{organization.slug}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 self-start sm:self-auto">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Session
            </span>
          </div>
        </div>
      </div>

      {/* Operational State Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Role & Access */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Access & Role</p>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-zinc-900 mt-2">
              {membership.is_owner ? 'Primary Owner' : 'Team Member'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Role: <span className="font-medium text-zinc-700">{primaryRole}</span>
            </p>
            {operationalData?.permissions && operationalData.permissions.length > 0 && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Permissions:{' '}
                <span className="font-mono text-zinc-700">
                  {operationalData.permissions.join(', ')}
                </span>
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Membership: <span className="capitalize font-medium text-emerald-700">{membership.status}</span></span>
            <span className="text-zinc-400">&bull;</span>
            <span>
              {operationalData?.permissions && operationalData.permissions.length > 0
                ? `${operationalData.permissions.length} RBAC Permissions`
                : 'RBAC Active'}
            </span>
          </div>
        </div>

        {/* Card 2: 7-Day Free Trial */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Subscription</p>
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-lg font-bold text-zinc-900">
                {subscription?.planName || 'Standard'}
              </p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase tracking-wider">
                Trial
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {isTrialActive
                ? `${trialDaysRemaining} days remaining in trial`
                : 'Subscription active'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Policy: 7-Day Free Trial</span>
            <span className="text-zinc-400">&bull;</span>
            <span>No Card Charged</span>
          </div>
        </div>

        {/* Card 3: Operating Branch */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Operating Branch</p>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-zinc-900 mt-2">
              {branch?.name || 'Headquarters'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Primary operational facility
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Branch: Operational</span>
            <span className="text-zinc-400">&bull;</span>
            <span>Multi-Branch Ready</span>
          </div>
        </div>
      </div>

      {/* Operational Readiness Panel */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
              Workspace Provisioning Status
            </h2>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
          >
            <span>Configure Business</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50/80 border border-zinc-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-zinc-800">Organization Verified</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Subdomain & schema provisioned</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50/80 border border-zinc-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-zinc-800">Primary Ownership</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Owner governance assigned</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50/80 border border-zinc-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-zinc-800">Headquarters Ready</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Operating branch initialized</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50/80 border border-zinc-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-zinc-800">7-Day Trial License</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Standard tier trial active</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
          <p>
            Operating environment: <span className="font-semibold text-zinc-700">My Business by STACK37</span> &bull; Cloud SaaS
          </p>
          <p className="font-mono text-[11px] text-zinc-400">
            RLS Enforcement: Active
          </p>
        </div>
      </div>
    </div>
  );
}
