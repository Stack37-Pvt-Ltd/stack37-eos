import type { Metadata } from 'next';
import { Brand } from '../../../components/ui/brand';
import { InvitationAcceptance } from '../../../components/tenant/team-management';

export const metadata: Metadata = {
  title: 'Accept invitation — My Business by STACK37',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';

export default async function AcceptInvitationPage(props: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await props.searchParams;
  // Token lookup and acceptance are intentionally not connected until the security-verified
  // Antigravity actions are integrated into this baseline.
  const invitation = token
    ? { status: 'unavailable' as const }
    : { status: 'invalid' as const };
  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-brand-line bg-white"><div className="app-container py-4"><Brand compact /></div></header>
    <InvitationAcceptance invitation={invitation} />
  </div>;
}
