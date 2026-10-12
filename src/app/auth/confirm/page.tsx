import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '../../../components/auth/auth-shell';
import { ConfirmCard } from '../../../components/auth/confirm-card';

export const metadata: Metadata = {
  title: 'Confirm Verification — My Business by STACK37',
  description: 'Verify your My Business by STACK37 account or password recovery session.',
};

export default function ConfirmPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64 flex items-center justify-center text-zinc-400">Loading verification details...</div>}>
        <ConfirmCard />
      </Suspense>
    </AuthShell>
  );
}
