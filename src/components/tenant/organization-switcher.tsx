'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronsUpDown, ExternalLink, Plus } from 'lucide-react';
import { UserOrganization, getTenantWorkspaceUrl } from '../../lib/auth/tenant-utils';

export interface OrganizationSwitcherProps {
  currentSlug: string;
  currentOrgName: string;
  organizations: UserOrganization[];
  currentHost?: string;
}

export function OrganizationSwitcher({
  currentSlug,
  currentOrgName,
  organizations,
  currentHost = '',
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-200/80 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 shadow-2xs transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
          {currentOrgName.slice(0, 2).toUpperCase()}
        </span>
        <span className="truncate max-w-[140px] font-medium">{currentOrgName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5 z-50 py-1.5 focus:outline-none">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Workspaces ({organizations.length})
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
            {organizations.map((org) => {
              const isCurrent = org.slug === currentSlug;
              const targetUrl = getTenantWorkspaceUrl(org.slug, currentHost);

              return (
                <a
                  key={org.id}
                  href={targetUrl}
                  className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-50 transition-colors ${
                    isCurrent ? 'bg-emerald-50/50 text-emerald-900 font-semibold' : 'text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2
                      className={`h-4 w-4 shrink-0 ${
                        isCurrent ? 'text-emerald-600' : 'text-zinc-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{org.slug}</p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />
                  ) : (
                    <ExternalLink className="h-3 w-3 text-zinc-400 shrink-0 ml-2" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 mt-1 pt-1 px-1">
            <Link
              href="/select-organization"
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Plus className="h-3.5 w-3.5 text-zinc-400" />
              <span>Workspace Directory</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
