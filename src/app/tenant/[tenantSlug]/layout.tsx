import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Workspace — My Business by STACK37',
  description: 'Multi-tenant isolated workspace on My Business by STACK37.',
};
import { requireTenantAccess, getUserOrganizations } from '../../../lib/auth/tenant-guard';
import { logoutAction } from '../../../lib/actions/auth';
import { TenantAccessDenied } from '../../../components/tenant/access-denied';
import { OrganizationSwitcher } from '../../../components/tenant/organization-switcher';
import {
  LayoutDashboard,
  Boxes,
  Settings,
  ShieldCheck,
  LogOut,
  User,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TenantLayout(props: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const params = await props.params;
  const access = await requireTenantAccess(params.tenantSlug);

  if (!access.authorized) {
    if (access.reason === 'unauthenticated') {
      return null;
    }
    if (access.reason === 'suspended') {
      return (
        <TenantAccessDenied
          tenantSlug={params.tenantSlug}
          reason="suspended"
          userEmail={access.user.email}
          organizationName={access.organizationName}
        />
      );
    }
    return (
      <TenantAccessDenied
        tenantSlug={params.tenantSlug}
        reason="not_a_member"
        userEmail={access.user.email}
      />
    );
  }

  const { organization, membership, user } = access.context;
  const userOrganizations = await getUserOrganizations();
  const headerList = await headers();
  const currentHost = headerList.get('host') || '';

  async function handleSignOut() {
    'use server';
    await logoutAction({ scope: 'local' });
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 h-14 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 group select-none"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white group-hover:bg-emerald-600 transition-colors">
              <span className="text-emerald-400 group-hover:text-white font-bold text-xs">37</span>
            </span>
            <span className="font-bold text-sm tracking-tight text-zinc-900 hidden sm:inline">
              My Business
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded hidden sm:inline">
              by STACK37
            </span>
          </Link>

          <div className="h-4 w-px bg-zinc-200" />

          <OrganizationSwitcher
            currentSlug={organization.slug}
            currentOrgName={organization.name}
            organizations={userOrganizations}
            currentHost={currentHost}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/60 px-2.5 py-1 rounded-lg">
            <User className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-medium text-zinc-700">{user.email}</span>
            {membership.is_owner && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded">
                Owner
              </span>
            )}
          </div>

          <form action={handleSignOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200/80 hover:bg-zinc-50 px-2.5 py-1 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex">
        {/* Workspace Sidebar */}
        <aside className="w-56 bg-white border-r border-zinc-200/80 p-4 flex flex-col justify-between hidden md:flex">
          <nav className="space-y-1">
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50/60 border border-emerald-200/40 rounded-lg"
            >
              <LayoutDashboard className="h-4 w-4 text-emerald-600" />
              <span>Dashboard</span>
            </Link>

            <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-700 rounded-lg cursor-not-allowed">
              <Boxes className="h-4 w-4" />
              <span>Modules</span>
            </div>

            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4 text-zinc-500" />
              <span>Settings</span>
            </Link>
          </nav>

          <div className="border-t border-zinc-100 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">Tenant: {organization.slug}</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl">
          {props.children}
        </main>
      </div>
    </div>
  );
}
