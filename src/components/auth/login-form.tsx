'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { loginAction } from '../../lib/actions/auth';
import { sanitizeRedirectPath } from '../../lib/validations/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = searchParams.get('next');
  const callbackError = searchParams.get('error');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    callbackError === 'auth_callback_failed'
      ? 'Authentication link was invalid or has expired. Please sign in again.'
      : null
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setErrorMessage(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await loginAction({ email, password });
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else {
        const safeDestination = sanitizeRedirectPath(nextTarget, '/select-organization');
        router.push(safeDestination);
        router.refresh();
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Sign in</CardTitle>
        <CardDescription>
          Access your workspace.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} aria-busy={isLoading}>
        <CardContent>
          {errorMessage && (
            <Alert variant="error" className="mb-4">
              {errorMessage}
            </Alert>
          )}

          <Input
            id="email"
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={isLoading}
            required
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={isLoading}
              required
            />
          </div>

          <Button type="submit" variant="primary" size="md" className="w-full mt-2" isLoading={isLoading}>
            Sign in
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-slate-500 text-xs">
            New to My Business?{' '}
            <Link href="/register" className="text-blue-600 font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
