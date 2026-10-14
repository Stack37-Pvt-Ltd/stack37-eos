import Link from 'next/link';
import { ArrowRight, Building2, Clock, UserCheck } from 'lucide-react';
import { Button } from '../ui/button';
import type { WorkspaceOperationalData } from '../../lib/auth/workspace-context';

export function WorkspaceOverview({ organization, membership, data }: {
  organization: { name: string; slug: string };
  membership: { is_owner: boolean; status: string };
  data: WorkspaceOperationalData | null;
}) {
  const subscription = data?.subscription;
  const branch = data?.assignedBranch;
  const primaryRole = data?.roles[0]?.name || (membership.is_owner ? 'Primary Owner' : 'Team Member');
  const subscriptionMessage = !subscription
    ? 'Subscription details unavailable'
    : subscription.status === 'trialing'
      ? subscription.daysRemaining > 0
        ? `${subscription.daysRemaining} days left in trial`
        : 'Trial ended'
      : subscription.status === 'active'
        ? 'Subscription active'
        : subscription.status.replace('_', ' ');
  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Overview</p>
          <h1 className="break-words text-3xl font-semibold tracking-[-0.045em]">{organization.name}</h1>
          <p className="mt-2 text-sm text-slate-600">Your business workspace{data?.organization.countryCode ? ` · ${data.organization.countryCode}` : ''}</p>
        </div>
        <span className="self-start border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">Active session</span>
      </div>
      <div className="grid border-y border-brand-line sm:grid-cols-3">
        <div className="border-b border-brand-line py-6 sm:border-r sm:border-b-0 sm:pr-6">
          <UserCheck className="mb-4 h-5 w-5 text-brand-blue" />
          <p className="text-xs text-slate-500">Access</p>
          <p className="mt-2 text-lg font-semibold">{membership.is_owner ? 'Primary Owner' : 'Team Member'}</p>
          <p className="mt-1 text-sm text-slate-600">{primaryRole} · {membership.status}</p>
        </div>
        <div className="border-b border-brand-line py-6 sm:border-r sm:border-b-0 sm:px-6">
          <Clock className="mb-4 h-5 w-5 text-brand-blue" />
          <p className="text-xs text-slate-500">Subscription</p>
          <p className="mt-2 text-lg font-semibold">{subscription?.planName || 'Unavailable'}</p>
          <p className="mt-1 text-sm text-slate-600">{subscriptionMessage}</p>
        </div>
        <div className="py-6 sm:pl-6">
          <Building2 className="mb-4 h-5 w-5 text-brand-blue" />
          <p className="text-xs text-slate-500">Operating location</p>
          <p className="mt-2 text-lg font-semibold">{branch?.name || 'Headquarters'}</p>
          <p className="mt-1 text-sm text-slate-600">Primary location</p>
        </div>
      </div>
      <section className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div><h2 className="text-lg font-semibold">Business settings</h2><p className="mt-2 text-sm text-slate-600">Manage your profile, tax details and Headquarters.</p></div>
        <Button asChild><Link href="/settings">Open settings <ArrowRight className="h-4 w-4" /></Link></Button>
      </section>
      {data && <details className="border-t border-brand-line pt-5 text-sm"><summary className="cursor-pointer text-slate-600">Workspace details</summary><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Workspace</dt><dd className="mt-1 break-all font-mono">{organization.slug}</dd></div><div><dt className="text-slate-500">Access</dt><dd className="mt-1 break-words">Access is managed through your assigned workspace role.</dd></div></dl></details>}
    </div>
  );
}
