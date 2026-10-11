import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { SignupForm } from '../../components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create Account — STACK37 EOS',
  description: 'Create an account on STACK37 Enterprise Operating System.',
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
