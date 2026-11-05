'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronsUpDown, ExternalLink, Plus } from 'lucide-react';
import { UserOrganization } from '../../lib/auth/tenant-utils';

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
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-11 max-w-full items-center gap-2.5 border border-brand-line bg-white px-3 text-sm text-brand-navy hover:bg-slate-50"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-none bg-blue-50 text-blue-700 border border-blue-200/60 font-bold text-[10px]">
          {currentOrgName.slice(0, 2).toUpperCase()}
        </span>
        <span className="truncate max-w-[220px] font-medium">{currentOrgName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      </button>

      {isOpen && (
        <div id={panelId} className="absolute left-0 z-50 mt-1 w-72 max-w-[calc(100vw-40px)] border border-brand-line bg-white py-2 shadow-lg" aria-label="Workspaces">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspaces ({organizations.length})
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {organizations.map((org) => {
              const isCurrent = org.slug === currentSlug;
              const targetUrl = `/w/${encodeURIComponent(org.slug)}`;

              return (
                <a
                  key={org.id}
                  href={targetUrl}
                  className={`flex min-h-11 items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    isCurrent ? 'bg-blue-50/50 text-blue-900 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2
                      className={`h-4 w-4 shrink-0 ${
                        isCurrent ? 'text-blue-600' : 'text-slate-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{org.slug}</p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />
                  ) : (
                    <ExternalLink className="h-3 w-3 text-slate-500 shrink-0 ml-2" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="border-t border-slate-100 mt-1 pt-1 px-1">
            <Link
              href="/select-organization"
              className="flex min-h-11 items-center gap-2 px-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              onClick={() => setIsOpen(false)}
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" />
              <span>Workspace Directory</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
