import Link from 'next/link';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { getTenantWorkspaceUrl, type UserOrganization } from '../../lib/auth/tenant-utils';

export function WorkspaceDirectory({ organizations, host }: { organizations: UserOrganization[]; host: string }) {
  return (
    <section>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">My Business</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">Choose a workspace</h1>
          <p className="mt-2 text-sm text-slate-600">Select a business.</p>
        </div>
        <Button asChild variant="outline"><Link href="/registration"><Plus className="h-4 w-4" />Register a business</Link></Button>
      </div>
      {organizations.length > 0 ? (
        <div className="border-t border-brand-line">
          {organizations.map(org => (
            <a key={org.id} href={getTenantWorkspaceUrl(org.slug, host)} className="group flex min-h-24 items-center gap-4 border-b border-brand-line py-5 hover:bg-slate-50">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-sm font-semibold text-blue-700">{org.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-brand-navy">{org.name}</span>
                <span className="mt-1 block truncate font-mono text-xs text-slate-500">{org.slug}</span>
              </span>
              {org.is_owner && <span className="hidden text-xs text-slate-600 sm:block">Primary Owner</span>}
              <ArrowRight aria-hidden="true" className="mr-2 h-4 w-4 shrink-0 text-slate-500 group-hover:text-brand-blue" />
            </a>
          ))}
        </div>
      ) : (
        <div className="border-y border-brand-line py-12 text-center">
          <Building2 className="mx-auto mb-4 h-7 w-7 text-slate-500" />
          <h2 className="font-semibold">No active workspaces</h2>
          <p className="mt-2 text-sm text-slate-600">Register a business to get started.</p>
        </div>
      )}
    </section>
  );
}
