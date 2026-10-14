import * as React from 'react';
import { Brand } from '../ui/brand';

export interface AuthShellProps { children: React.ReactNode; }

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-frame">
      <aside className="auth-brand">
        <Brand />
        <p className="auth-headline">Run your business.<span>Better. Together.</span></p>
      </aside>
      <main id="main-content" className="auth-content">
        <div className="auth-form">
          <p className="eyebrow mb-6">My Business by STACK37</p>
          {children}
        </div>
      </main>
    </div>
  );
}
