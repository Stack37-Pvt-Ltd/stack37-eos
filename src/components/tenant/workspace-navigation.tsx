'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supportsRetailOperations } from '../../lib/industry/category-features';

export function WorkspaceNavigation({ categoryName }: { categoryName?: string | null }) {
  const pathname = usePathname() || '';
  const previewMatch = pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  const basePath = previewMatch ? `/w/${previewMatch[1]}` : '';
  const overviewHref = basePath || '/';
  const settingsHref = `${basePath}/settings`;
  const teamHref = `${basePath}/settings/team`;
  const retailHref = `${basePath}/retail`;
  const inRetail = pathname.endsWith('/retail') || pathname.includes('/retail/');
  const inTeam = pathname === '/settings/team' || pathname.endsWith('/settings/team');
  const inSettings = !inTeam && (pathname === '/settings' || pathname.endsWith('/settings'));
  return (
    <nav aria-label="Workspace" className="workspace-nav">
      <div className="app-container flex gap-2">
        <Link href={overviewHref} aria-current={!inSettings && !inTeam && !inRetail ? 'page' : undefined}>Overview</Link>
        <Link href={settingsHref} aria-current={inSettings ? 'page' : undefined}>Business settings</Link>
        <Link href={teamHref} aria-current={inTeam ? 'page' : undefined}>Team</Link>
        {supportsRetailOperations(categoryName) && <Link href={retailHref} aria-current={inRetail ? 'page' : undefined}>Retail &amp; E-Commerce</Link>}
      </div>
    </nav>
  );
}
