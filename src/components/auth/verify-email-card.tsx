'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react';

export function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
          <Mail className="h-6 w-6" />
        </div>
        <CardTitle className="text-center">Verify your email</CardTitle>
        <CardDescription className="text-center">
          {email ? (
            <>
              We sent a confirmation link to{' '}
              <span className="font-semibold text-zinc-900">{email}</span>
            </>
          ) : (
            'We sent a confirmation link to your registered work email.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-4 text-xs text-zinc-600 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Email verification is required before your account can access organization workspaces.
            </p>
          </div>
          <p className="text-zinc-500 pl-6 leading-relaxed">
            Please click the confirmation link in the email to activate your account. If you don&apos;t see the message within a few minutes, check your spam or junk folder.
          </p>
        </div>

        <Link href="/login" className="block w-full">
          <Button variant="primary" size="md" className="w-full">
            Proceed to Sign In
          </Button>
        </Link>
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>
      </CardFooter>
    </Card>
  );
}
