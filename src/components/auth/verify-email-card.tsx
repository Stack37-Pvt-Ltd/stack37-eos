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
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-none bg-blue-50 text-blue-600 border border-blue-100">
          <Mail className="h-6 w-6" />
        </div>
        <CardTitle as="h1" className="text-center">Verify your email</CardTitle>
        <CardDescription className="text-center">
          {email ? (
            <>
              We sent a confirmation link to{' '}
              <span className="font-semibold text-slate-900">{email}</span>
            </>
          ) : (
            'We sent a confirmation link to your registered work email.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-none bg-slate-50 border border-slate-200/60 p-4 text-xs text-slate-600 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Confirm your email to access your workspaces.
            </p>
          </div>
          <p className="text-slate-500 pl-6 leading-relaxed">
            Open the link in your email, then confirm. Check your spam folder if it hasn’t arrived.
          </p>
        </div>

        <Button asChild variant="primary" size="md" className="w-full"><Link href="/login" className="block w-full">
            Sign in
          </Link></Button>
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>
      </CardFooter>
    </Card>
  );
}
