'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function WorkspaceNavigation() {
  const pathname = usePathname() || '';
  const previewMatch = pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  const basePath = previewMatch ? `/w/${previewMatch[1]}` : '';
  const overviewHref = basePath || '/';
  const settingsHref = `${basePath}/settings`;
  const teamHref = `${basePath}/settings/team`;
  const inTeam = pathname === '/settings/team' || pathname.endsWith('/settings/team');
  const inSettings = !inTeam && (pathname === '/settings' || pathname.endsWith('/settings'));
  return (
    <nav aria-label="Workspace" className="workspace-nav">
      <div className="app-container flex gap-2">
        <Link href={overviewHref} aria-current={!inSettings && !inTeam ? 'page' : undefined}>Overview</Link>
        <Link href={settingsHref} aria-current={inSettings ? 'page' : undefined}>Business settings</Link>
        <Link href={teamHref} aria-current={inTeam ? 'page' : undefined}>Team</Link>
      </div>
    </nav>
  );
}
