'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function WorkspaceNavigation() {
  const pathname = usePathname();
  // Public tenant URLs are rewritten internally; preserve the existing destinations.
  const inTeam = pathname === '/settings/team' || pathname.endsWith('/settings/team');
  const inSettings = !inTeam && (pathname === '/settings' || pathname.endsWith('/settings'));
  return (
    <nav aria-label="Workspace" className="workspace-nav">
      <div className="app-container flex gap-2">
        <Link href="/" aria-current={!inSettings && !inTeam ? 'page' : undefined}>Overview</Link>
        <Link href="/settings" aria-current={inSettings ? 'page' : undefined}>Business settings</Link>
        <Link href="/settings/team" aria-current={inTeam ? 'page' : undefined}>Team</Link>
      </div>
    </nav>
  );
}
