import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { ForgotPasswordForm } from '../../components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset Password — My Business by STACK37',
  description: 'Request a password reset link for your My Business by STACK37 account.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
