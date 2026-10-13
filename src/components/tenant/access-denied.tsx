'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { ShieldAlert, UserX, ArrowRight, LogOut } from 'lucide-react';
import { logoutAction } from '../../lib/actions/auth';

export interface TenantAccessDeniedProps {
  tenantSlug: string;
  reason: 'not_a_member' | 'suspended';
  userEmail?: string;
  organizationName?: string;
}

export function TenantAccessDenied({
  tenantSlug,
  reason,
  userEmail,
  organizationName,
}: TenantAccessDeniedProps) {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutAction({ scope: 'local' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const isSuspended = reason === 'suspended';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-zinc-200/80 shadow-xs">
          <CardHeader>
            <div
              className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border ${
                isSuspended
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}
            >
              {isSuspended ? (
                <UserX className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <CardTitle className="text-center text-lg font-bold">
              {isSuspended ? 'Membership Suspended' : 'Access Restricted'}
            </CardTitle>
            <CardDescription className="text-center">
              {isSuspended ? (
                <>
                  Your employee access to{' '}
                  <span className="font-semibold text-zinc-900">
                    {organizationName || tenantSlug}
                  </span>{' '}
                  has been suspended.
                </>
              ) : (
                <>
                  You do not have active membership in the{' '}
                  <span className="font-semibold text-zinc-900">
                    {tenantSlug}
                  </span>{' '}
                  workspace.
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-zinc-100/70 border border-zinc-200/60 p-3.5 text-xs text-zinc-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Signed in as:</span>
                <span className="font-mono font-medium text-zinc-800">
                  {userEmail || 'Authenticated User'}
                </span>
              </div>
              <p className="text-zinc-500 pt-1 leading-relaxed border-t border-zinc-200/60">
                {isSuspended
                  ? 'Access to this workspace has been temporarily revoked by your organization administrator.'
                  : 'If you were recently invited, ensure your invitation was accepted using this email address.'}
              </p>
            </div>

            <Link href="/select-organization" className="block w-full">
              <Button variant="primary" size="md" className="w-full justify-center gap-2">
                <span>View Authorized Workspaces</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="md"
              className="w-full justify-center gap-2 text-zinc-700"
              onClick={handleLogout}
              isLoading={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out / Switch Account</span>
            </Button>
          </CardContent>

          <CardFooter className="justify-center border-t border-zinc-100 pt-4">
            <p className="text-[11px] text-zinc-400 text-center">
              My Business by STACK37 Multi-Tenant Security
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
