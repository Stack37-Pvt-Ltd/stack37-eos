import type { Metadata } from 'next';
import { AuthShell } from '../../components/auth/auth-shell';
import { SignupForm } from '../../components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create Account — My Business by STACK37',
  description: 'Create an account on My Business by STACK37.',
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
