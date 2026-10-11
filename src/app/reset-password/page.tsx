import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { ResetPasswordForm } from '../../components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password — STACK37 EOS',
  description: 'Set a new password for your STACK37 EOS account.',
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
