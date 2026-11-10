'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supportsRetailOperations } from '../../lib/industry/category-features';

export function WorkspaceNavigation({ tenantSlug, categoryName }: { tenantSlug: string; categoryName?: string | null }) {
  const pathname = usePathname();
  const workspacePath = `/w/${encodeURIComponent(tenantSlug)}`;
  const inOverview = pathname === workspacePath || pathname === `${workspacePath}/`;
  const inSettings = pathname === `${workspacePath}/settings`;
  const inRetail = pathname.startsWith(`${workspacePath}/retail`);
  return (
    <nav aria-label="Workspace" className="workspace-nav">
      <div className="app-container flex flex-wrap gap-2">
        <Link href={workspacePath} aria-current={inOverview ? 'page' : undefined}>Overview</Link>
        {supportsRetailOperations(categoryName) && <Link href={`${workspacePath}/retail`} aria-current={inRetail ? 'page' : undefined}>Retail &amp; E-Commerce</Link>}
        <Link href={`${workspacePath}/settings`} aria-current={inSettings ? 'page' : undefined}>Business settings</Link>
      </div>
    </nav>
  );
}
