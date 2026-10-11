import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { ForgotPasswordForm } from '../../components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset Password — STACK37 EOS',
  description: 'Request a password reset link for your STACK37 EOS account.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
