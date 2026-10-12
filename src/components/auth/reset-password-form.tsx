'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { resetPasswordAction } from '../../lib/actions/auth';
import { Check, X, CheckCircle2 } from 'lucide-react';

export function ResetPasswordForm() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Password rules validation
  const rules = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!isPasswordValid) {
      setErrorMessage('Please ensure your password meets all complexity requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPasswordAction({
        password,
        confirmPassword,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update password. Please try again.');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else {
        setIsSuccess(true);
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-center">Password updated</CardTitle>
          <CardDescription className="text-center">
            Your password has been securely reset. You can now log in with your new credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="block w-full">
            <Button variant="primary" size="md" className="w-full">
              Sign In to My Business by STACK37
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isSessionError = errorMessage && (
    errorMessage.toLowerCase().includes('expired') ||
    errorMessage.toLowerCase().includes('recovery') ||
    errorMessage.toLowerCase().includes('unauthorized')
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>
          Enter your new password below. It must meet standard enterprise security requirements.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent>
          {errorMessage && (
            <div className="space-y-3 mb-4">
              <Alert variant="error">{errorMessage}</Alert>
              {isSessionError && (
                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    Request a new password reset link &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          <Input
            id="password"
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={isLoading}
            required
          />

          {password.length > 0 && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-3 space-y-1.5 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-700 block mb-1">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-700 font-medium' : 'text-zinc-500'}`}>
                  {rules.length ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.lower ? 'text-emerald-700 font-medium' : 'text-zinc-500'}`}>
                  {rules.lower ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.upper ? 'text-emerald-700 font-medium' : 'text-zinc-500'}`}>
                  {rules.upper ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.number ? 'text-emerald-700 font-medium' : 'text-zinc-500'}`}>
                  {rules.number ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <span>Number</span>
                </div>
                <div className={`flex items-center gap-1.5 col-span-2 ${rules.special ? 'text-emerald-700 font-medium' : 'text-zinc-500'}`}>
                  {rules.special ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  <span>Special symbol (!@#$%^&*)</span>
                </div>
              </div>
            </div>
          )}

          <Input
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={isLoading}
            required
          />

          <Button type="submit" variant="primary" size="md" className="w-full mt-2" isLoading={isLoading}>
            Update Password
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-zinc-500 text-xs">
            Remember your existing password?{' '}
            <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
