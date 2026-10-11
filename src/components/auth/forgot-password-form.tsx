'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { forgotPasswordAction } from '../../lib/actions/auth';
import { MailCheck } from 'lucide-react';

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await forgotPasswordAction({ email });
      if (!res.success) {
        setErrorMessage(res.error || 'Unable to process your request. Please try again.');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else {
        setIsSubmitted(true);
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-center">Check your inbox</CardTitle>
          <CardDescription className="text-center">
            If an account is registered with <span className="font-semibold text-zinc-800">{email}</span>, we have sent instructions to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-zinc-500 text-center leading-relaxed">
            The recovery link will expire shortly for security. Be sure to check your spam or junk folder if you don&apos;t see it in a few moments.
          </p>
          <Link href="/login" className="block w-full">
            <Button variant="secondary" size="md" className="w-full">
              Return to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter the work email associated with your account and we&apos;ll send you a password recovery link.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent>
          {errorMessage && (
            <Alert variant="error" className="mb-4">
              {errorMessage}
            </Alert>
          )}

          <Input
            id="email"
            label="Work Email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={isLoading}
            required
          />

          <Button type="submit" variant="primary" size="md" className="w-full mt-2" isLoading={isLoading}>
            Send Recovery Link
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-zinc-500 text-xs">
            Remember your password?{' '}
            <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
