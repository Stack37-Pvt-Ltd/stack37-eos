'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function WorkspaceNavigation({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const workspacePath = `/w/${encodeURIComponent(tenantSlug)}`;
  const inOverview = pathname === workspacePath || pathname === `${workspacePath}/`;
  const inSettings = pathname === `${workspacePath}/settings`;
  return (
    <nav aria-label="Workspace" className="workspace-nav">
      <div className="app-container flex flex-wrap gap-2">
        <Link href={workspacePath} aria-current={inOverview ? 'page' : undefined}>Overview</Link>
        <Link href={`${workspacePath}/settings`} aria-current={inSettings ? 'page' : undefined}>Business settings</Link>
      </div>
    </nav>
  );
}
