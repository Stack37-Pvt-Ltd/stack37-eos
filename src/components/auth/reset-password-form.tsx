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
  const isSubmittingRef = React.useRef(false);

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
    if (isSubmittingRef.current) return;
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

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  };

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-none bg-blue-50 text-blue-600 border border-blue-100">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle as="h1" className="text-center">Password updated</CardTitle>
          <CardDescription className="text-center">
            Sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="primary" size="md" className="w-full"><Link href="/login" className="block w-full">
              Sign in
            </Link></Button>
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
        <CardTitle as="h1">Set new password</CardTitle>
        <CardDescription>
          Choose a strong password.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} aria-busy={isLoading}>
        <CardContent>
          {errorMessage && (
            <div className="space-y-3 mb-4">
              <Alert variant="error">{errorMessage}</Alert>
              {isSessionError && (
                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 font-semibold hover:underline"
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
            <div className="rounded-none bg-slate-50 border border-slate-200/60 p-3 space-y-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block mb-1">Password requirements</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`flex items-center gap-1.5 ${rules.length ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {rules.length ? <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.lower ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {rules.lower ? <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.upper ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {rules.upper ? <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.number ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {rules.number ? <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                  <span>Number</span>
                </div>
                <div className={`flex items-center gap-1.5 col-span-2 ${rules.special ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                  {rules.special ? <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
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
            Update password
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-slate-500 text-xs">
            Remember your existing password?{' '}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
