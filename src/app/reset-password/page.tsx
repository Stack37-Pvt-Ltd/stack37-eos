import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { ResetPasswordForm } from '../../components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password — My Business by STACK37',
  description: 'Set a new password for your My Business by STACK37 account.',
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
