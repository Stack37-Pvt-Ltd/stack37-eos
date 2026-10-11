import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '../../components/auth/auth-shell';
import { LoginForm } from '../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign In — STACK37 EOS',
  description: 'Sign in to access your STACK37 Enterprise Operating System workspace.',
};

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-72 flex items-center justify-center text-zinc-400">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
