import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '../../components/auth/auth-shell';
import { VerifyEmailCard } from '../../components/auth/verify-email-card';

export const metadata: Metadata = {
  title: 'Verify Email — My Business by STACK37',
  description: 'Verify your work email address to activate your account.',
};

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64 flex items-center justify-center text-zinc-400">Loading...</div>}>
        <VerifyEmailCard />
      </Suspense>
    </AuthShell>
  );
}
