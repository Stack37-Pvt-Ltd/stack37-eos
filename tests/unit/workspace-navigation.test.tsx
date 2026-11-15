import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const routeState = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => routeState.pathname }));

import { WorkspaceNavigation } from '../../src/components/tenant/workspace-navigation';

describe('Workspace navigation', () => {
  beforeEach(() => { routeState.pathname = '/'; });

  it('keeps preview navigation within the active /w tenant path', () => {
    routeState.pathname = '/w/serendib/settings/team';
    const html = renderToStaticMarkup(<WorkspaceNavigation />);

    expect(html).toContain('href="/w/serendib"');
    expect(html).toContain('href="/w/serendib/settings"');
    expect(html).toContain('href="/w/serendib/settings/team"');
    expect(html).toContain('aria-current="page" href="/w/serendib/settings/team"');
    expect(html).not.toContain('href="/settings/team"');
  });

  it('preserves existing public paths on production tenant subdomains', () => {
    routeState.pathname = '/settings/team';
    const html = renderToStaticMarkup(<WorkspaceNavigation />);

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/settings/team"');
    expect(html).toContain('aria-current="page" href="/settings/team"');
  });
});
