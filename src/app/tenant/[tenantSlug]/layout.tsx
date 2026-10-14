import * as React from 'react';
import type { Metadata } from 'next';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Workspace — My Business by STACK37',
  description: 'Multi-tenant isolated workspace on My Business by STACK37.',
};
import { requireTenantAccess, getUserOrganizations } from '../../../lib/auth/tenant-guard';
import { logoutAction } from '../../../lib/actions/auth';
import { TenantAccessDenied } from '../../../components/tenant/access-denied';

import { LogOut } from 'lucide-react';
import { WorkspaceFrame } from '../../../components/tenant/workspace-frame';
import { Button } from '../../../components/ui/button';

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
    <WorkspaceFrame organization={organization} organizations={userOrganizations} host={currentHost} email={user.email} isOwner={membership.is_owner}
      accountActions={<form action={handleSignOut}><Button variant="outline" size="sm" type="submit"><LogOut className="h-4 w-4" /><span>Sign out</span></Button></form>}>
      {props.children}
    </WorkspaceFrame>
  );
}
