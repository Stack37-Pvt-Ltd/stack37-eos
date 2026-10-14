'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { confirmOtpAction } from '../../lib/actions/auth';
import type { EmailOtpType } from '@supabase/supabase-js';
import {
  MailCheck,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Clock,
  ArrowRight,
} from 'lucide-react';

export function ConfirmCard() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash') || '';
  const rawType = searchParams.get('type');
  const type = (rawType as EmailOtpType) || 'email';
  const next = searchParams.get('next') || undefined;

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const isSubmittingRef = React.useRef(false);

  const isRecovery = type === 'recovery';
  const hasValidParams = Boolean(tokenHash && rawType);

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasValidParams || isLoading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await confirmOtpAction({
        tokenHash,
        type,
        next,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Verification failed. Please request a new link.');
        setIsLoading(false);
        isSubmittingRef.current = false;
      } else {
        setIsSuccess(true);
        // Navigate via full window location to ensure fresh host-only cookie context
        window.location.href = res.data?.redirectTo || (isRecovery ? '/reset-password' : '/select-organization');
      }
    } catch {
      setErrorMessage('A network error occurred during confirmation. Please try again.');
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // State 1: Missing or invalid parameters in URL
  if (!hasValidParams) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-none bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle as="h1" className="text-center">Invalid link</CardTitle>
          <CardDescription className="text-center">
            Open the complete link from your email.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="warning" title="Link incomplete">
            Copy the complete link from your email and try again.
          </Alert>

          <Button asChild variant="secondary" size="md" className="w-full"><Link href="/login" className="block w-full">
              Back to sign in
            </Link></Button>
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span>Need a new link? Reset your password</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // State 2: Valid parameters, ready for deliberate user action
  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-none bg-blue-50 text-blue-600 border border-blue-100">
          {isRecovery ? <KeyRound className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
        </div>
        <CardTitle as="h1" className="text-center">
          {isRecovery ? 'Confirm password reset' : 'Confirm your email'}
        </CardTitle>
        <CardDescription className="text-center">
          {isRecovery
            ? 'Continue to reset your password.'
            : 'Confirm to activate your account.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="error" title="Verification Failed">
            {errorMessage}
          </Alert>
        )}

        {isSuccess ? (
          <div className="rounded-none bg-blue-50 border border-blue-200/60 p-4 text-center space-y-2">
            <ShieldCheck className="h-6 w-6 text-blue-600 mx-auto" />
            <p className="text-sm font-semibold text-blue-950">
              Confirmed
            </p>
            <p className="text-xs text-blue-700">
              Opening your workspace…
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-none bg-slate-50 border border-slate-200/60 p-4 text-xs text-slate-600 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="font-medium text-slate-900">
                  {isRecovery ? 'Confirm to continue' : 'Confirm to continue'}
                </p>
              </div>
              <p className="text-slate-500 pl-6 leading-relaxed">
                {isRecovery
                  ? 'The link is used only after you confirm, protecting it from email scanners.'
                  : 'The link is used only after you confirm, protecting it from email scanners.'}
              </p>
              {isRecovery && (
                <div className="flex items-start gap-2 pt-1 border-t border-slate-200/40 text-amber-800">
                  <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Once confirmed, your recovery session is active for <strong>15 minutes</strong>.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirm} aria-busy={isLoading}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading
                  ? 'Verifying...'
                  : isRecovery
                  ? 'Continue to password reset'
                  : 'Confirm and continue'}
              </Button>
            </form>
          </>
        )}
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
