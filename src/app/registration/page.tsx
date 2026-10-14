import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { RegistrationShell } from '../../components/organization/registration-shell';
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
    <RegistrationShell email={user.email}>
      <RegistrationForm userEmail={user.email} />
    </RegistrationShell>
  );
}
