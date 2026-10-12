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

  const isRecovery = type === 'recovery';
  const hasValidParams = Boolean(tokenHash && rawType);

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasValidParams || isLoading) return;

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
      } else {
        setIsSuccess(true);
        // Navigate via full window location to ensure fresh host-only cookie context
        window.location.href = res.data?.redirectTo || (isRecovery ? '/reset-password' : '/select-organization');
      }
    } catch {
      setErrorMessage('A network error occurred during confirmation. Please try again.');
      setIsLoading(false);
    }
  };

  // State 1: Missing or invalid parameters in URL
  if (!hasValidParams) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-center">Invalid Verification Link</CardTitle>
          <CardDescription className="text-center">
            This verification link is incomplete or missing necessary parameters.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="warning" title="Link Incomplete">
            The link you followed does not contain a valid confirmation token. Please check that you copied the complete URL from your email.
          </Alert>

          <Link href="/login" className="block w-full">
            <Button variant="secondary" size="md" className="w-full">
              Return to Sign In
            </Button>
          </Link>
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
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
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
          {isRecovery ? <KeyRound className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
        </div>
        <CardTitle className="text-center">
          {isRecovery ? 'Confirm Password Recovery' : 'Confirm Your Email'}
        </CardTitle>
        <CardDescription className="text-center">
          {isRecovery
            ? 'Verify your identity to proceed to secure password reset.'
            : 'Click below to verify your email and activate your My Business by STACK37 account.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="error" title="Verification Failed">
            {errorMessage}
          </Alert>
        )}

        {isSuccess ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200/60 p-4 text-center space-y-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-emerald-950">
              Identity Verified Successfully
            </p>
            <p className="text-xs text-emerald-700">
              Redirecting to your workspace destination...
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-4 text-xs text-zinc-600 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="font-medium text-zinc-900">
                  {isRecovery ? 'Single-Use Recovery Protection' : 'Enterprise Identity Verification'}
                </p>
              </div>
              <p className="text-zinc-500 pl-6 leading-relaxed">
                {isRecovery
                  ? 'To help prevent premature link consumption by automated email scanners, single-use token verification requires deliberate confirmation.'
                  : 'Confirming your work email ensures your session is securely established on this workspace host.'}
              </p>
              {isRecovery && (
                <div className="flex items-start gap-2 pt-1 border-t border-zinc-200/40 text-amber-800">
                  <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Once confirmed, your recovery session is active for <strong>15 minutes</strong>.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirm}>
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
                  ? 'Proceed to Reset Password'
                  : 'Confirm and Continue'}
              </Button>
            </form>
          </>
        )}
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
