import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import { getUserOrganizations, getTenantWorkspaceUrl } from '../../lib/auth/tenant-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Building2, ArrowRight, ShieldCheck, UserCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Select Organization — STACK37 EOS',
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

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-black text-2xl tracking-tight text-zinc-900 group select-none"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs group-hover:bg-emerald-600 transition-colors">
            <span className="text-emerald-400 group-hover:text-white font-bold text-lg">37</span>
          </span>
          <span className="tracking-tighter">STACK37</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
            EOS
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <Card className="border-zinc-200/80 shadow-xs">
          <CardHeader>
            <CardTitle>Select Workspace</CardTitle>
            <CardDescription>
              Choose an organization workspace to continue.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {organizations.length > 0 ? (
              <div className="divide-y divide-zinc-100 border border-zinc-200/60 rounded-xl overflow-hidden bg-white">
                {organizations.map((org) => {
                  const workspaceUrl = getTenantWorkspaceUrl(org.slug, host);
                  return (
                    <a
                      key={org.id}
                      href={workspaceUrl}
                      className="flex items-center justify-between p-4 hover:bg-zinc-50/80 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 font-bold border border-zinc-200/60 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-200 transition-colors shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-zinc-900 truncate text-sm">
                              {org.name}
                            </p>
                            {org.is_owner && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                                Owner
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate font-mono">
                            {org.slug}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 group-hover:text-emerald-600 transition-colors ml-4 shrink-0">
                        <span>Launch</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center space-y-3 bg-zinc-50/50">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm text-zinc-800">No active workspaces</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  Your account does not currently have active membership in any organization. If you were recently invited, check your email for an invitation.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 border-t border-zinc-100">
              <div className="flex items-center gap-1.5 truncate">
                <UserCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  className="font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </CardContent>

          <CardFooter className="justify-center border-t border-zinc-100 pt-4">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span>Multi-Tenant Access Control • STACK37 EOS</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
