import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { AuthShell } from '../../components/auth/auth-shell';
import { RegistrationForm } from '../../components/organization/registration-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RegistrationPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Enforce server-side authentication invariant:
  // Unauthenticated users are safely redirected to sign-in with return path
  if (error || !user) {
    redirect('/login?next=/registration');
  }

  return (
    <AuthShell>
      <RegistrationForm userEmail={user.email} />
    </AuthShell>
  );
}
