import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const pathnameState = vi.hoisted(() => ({ value: '/w/uk-super' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathnameState.value }));

import { WorkspaceNavigation } from '../../src/components/tenant/workspace-navigation';

describe('WorkspaceNavigation category tabs', () => {
  it('shows and activates Retail for Retail & E-Commerce businesses', () => {
    pathnameState.value = '/w/uk-super/retail/inventory';
    const html = renderToStaticMarkup(<WorkspaceNavigation categoryName="Retail & E-Commerce" />);

    expect(html).toContain('href="/w/uk-super/retail"');
    expect(html).toContain('Retail &amp; E-Commerce');
    expect(html).toContain('href="/w/uk-super/settings/team"');
    expect(html).toContain('>Team</a>');
    expect(html).toMatch(/aria-current="page" href="\/w\/uk-super\/retail"/);
    expect(html).not.toMatch(/href="\/w\/uk-super" aria-current="page"/);
  });

  it('does not show Retail for other business categories', () => {
    pathnameState.value = '/w/test';
    const html = renderToStaticMarkup(<WorkspaceNavigation categoryName="Construction & Real Estate" />);

    expect(html).not.toContain('Retail &amp; E-Commerce');
    expect(html).toContain('Overview');
  });
});
