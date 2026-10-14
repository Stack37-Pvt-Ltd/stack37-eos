import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Brand } from '../../components/ui/brand';
import { Button } from '../../components/ui/button';
import { WorkspaceDirectory } from '../../components/tenant/workspace-directory';
import { createClient } from '../../lib/supabase/server';
import { logoutAction } from '../../lib/actions/auth';
import { getUserOrganizations } from '../../lib/auth/tenant-guard';

export const metadata: Metadata = {
  title: 'Select Organization — My Business by STACK37',
  description: 'Choose your active organization workspace.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SelectOrganizationPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login?next=/select-organization');
  }

  const organizations = await getUserOrganizations();
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:3000';

  async function handleSignOut() {
    'use server';
    await logoutAction({ scope: 'local' });
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="app-header">
        <div className="app-container flex flex-wrap items-center justify-between gap-4 py-4">
          <Brand compact />
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden max-w-64 truncate text-xs text-slate-600 sm:block">{user.email}</span>
            <form action={handleSignOut}><Button type="submit" variant="outline" size="sm">Sign out</Button></form>
          </div>
        </div>
      </header>
      <main className="app-container py-10 sm:py-14">
        <WorkspaceDirectory organizations={organizations} host={host} />
      </main>
    </div>
  );
}
