import type { ReactNode } from 'react';
import Link from 'next/link';
import { Brand } from '../ui/brand';

export function RegistrationShell({ children, email }: { children: ReactNode; email?: string }) {
  return <div className="min-h-screen bg-white">
    <header className="app-header"><div className="app-container flex flex-wrap items-center justify-between gap-4 py-4">
      <Brand compact />
      <div className="flex items-center gap-5 text-xs"><span className="hidden max-w-60 truncate text-slate-600 sm:block">{email}</span><Link href="/select-organization" className="inline-flex min-h-10 items-center text-brand-blue hover:underline">Workspaces</Link></div>
    </div></header>
    <main className="app-container py-10 sm:py-14"><div className="max-w-xl"><p className="eyebrow mb-6">New workspace</p>{children}</div></main>
  </div>;
}
