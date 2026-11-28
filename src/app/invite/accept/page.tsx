import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Brand } from '../../../components/ui/brand';
import { InvitationAcceptance } from '../../../components/tenant/team-management';
import { createClient } from '../../../lib/supabase/server';
import { acceptInvitationAction, getInvitationDetailsAction } from '../../../lib/actions/team';

export const metadata: Metadata = {
  title: 'Accept invitation — My Business by STACK37',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';

export default async function AcceptInvitationPage(props: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await props.searchParams;
  const tokenValue = typeof token === 'string' ? token : '';
  const lookup = tokenValue ? await getInvitationDetailsAction(tokenValue) : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const invitation = lookup?.success && lookup.invitation
    ? { status: 'valid' as const, ...lookup.invitation }
    : { status: resolveInvitationStatus(lookup?.error), message: lookup?.error };

  async function accept(input: { fullName: string; password: string }) {
    'use server';
    if (!tokenValue) return { success: false, error: 'This invitation link is incomplete.' };
    const result = await acceptInvitationAction({ token: tokenValue, ...input });
    if (result.success && result.organizationSlug) {
      redirect(`/w/${encodeURIComponent(result.organizationSlug)}`);
    }
    return { success: false, emailConfirmationRequired: result.emailConfirmationRequired, error: result.error };
  }

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-brand-line bg-white"><div className="app-container py-4"><Brand compact /></div></header>
    <InvitationAcceptance
      invitation={invitation}
      token={tokenValue}
      authenticatedEmail={user?.email ?? null}
      previewReadOnly={false}
      onAccept={accept}
    />
  </div>;
}

function resolveInvitationStatus(error?: string): 'invalid' | 'expired' | 'revoked' | 'used' | 'unavailable' {
  const message = (error || '').toLowerCase();
  if (message.includes('expired')) return 'expired';
  if (message.includes('already accepted') || message.includes('already been accepted')) return 'used';
  if (message.includes('revoked') || message.includes('no longer active')) return 'revoked';
  if (!error || message.includes('invalid') || message.includes('does not exist')) return 'invalid';
  return 'unavailable';
}
