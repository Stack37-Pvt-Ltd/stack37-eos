import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link
          href="/"
          className="inline-flex flex-col items-center group select-none"
        >
          <div className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs group-hover:bg-emerald-600 transition-colors">
              <span className="text-emerald-400 group-hover:text-white font-bold text-lg">37</span>
            </span>
            <span className="font-black text-2xl tracking-tight text-zinc-900">
              My Business
            </span>
          </div>
          <span className="mt-1 text-xs font-semibold tracking-wider text-emerald-600 uppercase">
            by STACK37
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">{children}</div>

      <div className="mt-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span>Enterprise-grade tenancy security • My Business by STACK37</span>
      </div>
    </div>
  );
}
