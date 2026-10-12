'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { signupAction } from '../../lib/actions/auth';
import { Check, X } from 'lucide-react';

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

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
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await signupAction({
        fullName,
        email,
        password,
        confirmPassword,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed. Please check your details.');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else {
        if (res.emailConfirmationRequired) {
          // Do NOT misrepresent unconfirmed signup as an active session.
          // Route user directly to the verification notice.
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        } else {
          router.push('/select-organization');
          router.refresh();
        }
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Get started with My Business by STACK37.
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
            id="fullName"
            label="Full Name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
            disabled={isLoading}
            required
          />

          <Input
            id="email"
            label="Work Email"
            type="email"
            autoComplete="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={isLoading}
            required
          />

          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={isLoading}
            required
          />

          {/* Password complexity indicators */}
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
            label="Confirm Password"
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
            Create Account
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-zinc-500 text-xs">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
