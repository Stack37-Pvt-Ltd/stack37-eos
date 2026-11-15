import type { ReactNode } from 'react';
import { Brand } from '../ui/brand';
import { OrganizationSwitcher } from './organization-switcher';
import { WorkspaceNavigation } from './workspace-navigation';
import type { UserOrganization } from '../../lib/auth/tenant-utils';

export function WorkspaceFrame({ children, organization, organizations, host, email, isOwner, accountActions }: {
  children: ReactNode;
  organization: { slug: string; name: string };
  organizations: UserOrganization[];
  host: string;
  email?: string;
  isOwner: boolean;
  accountActions: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <header className="app-header">
        <div className="app-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Brand compact />
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <OrganizationSwitcher currentSlug={organization.slug} currentOrgName={organization.name} organizations={organizations} currentHost={host} />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:block text-right text-xs">
              <p className="max-w-64 truncate text-slate-700">{email}</p>
              <p className="mt-1 text-slate-500">{isOwner ? 'Primary Owner' : 'Team member'}</p>
            </div>
            {accountActions}
          </div>
        </div>
      </header>
      <WorkspaceNavigation />
      <main id="main-content" className="app-container min-w-0 overflow-x-clip py-8 sm:py-10">{children}</main>
    </div>
  );
}
