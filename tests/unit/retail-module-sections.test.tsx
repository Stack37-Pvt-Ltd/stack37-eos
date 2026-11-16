import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetailModulePanel, RetailModuleTabs } from '../../src/components/tenant/retail-module-sections';

describe('Retail module sections', () => {
  it('shows every section from the earlier retail workspace in the live retail navigation', () => {
    const html = renderToStaticMarkup(<RetailModuleTabs selected="customers" onSelect={() => undefined} />);

    for (const label of ['Purchasing', 'Customers', 'Employees', 'Expenses', 'Branches', 'Loyalty &amp; offers', 'Reports', 'Controls']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-pressed="true"');
  });

  it('keeps unconnected module actions disabled and identifies their unavailable data', () => {
    const html = renderToStaticMarkup(<RetailModulePanel section="customers" organizationSlug="uk-super" />);

    expect(html).toContain('Not connected yet');
    expect(html).toContain('Customer profiles and purchase history will appear when customer management is connected.');
    expect(html).toContain('Add customer</button>');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Unavailable');
  });

  it('routes employee management to the existing Team page', () => {
    const html = renderToStaticMarkup(<RetailModulePanel section="employees" organizationSlug="uk-super" />);

    expect(html).toContain('Employee management is in Team');
    expect(html).toContain('href="/w/uk-super/settings/team"');
    expect(html).toContain('Open Team');
  });
});
