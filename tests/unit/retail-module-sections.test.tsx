import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetailModulePanel, RetailModuleTabs } from '../../src/components/tenant/retail-module-sections';

describe('Retail module sections', () => {
  it('shows every section from the earlier retail workspace in the live retail navigation', () => {
    const html = renderToStaticMarkup(<RetailModuleTabs selected="customers" onSelect={() => undefined} />);

    for (const label of ['Purchasing', 'Customers', 'Expenses', 'Branches', 'Loyalty &amp; offers', 'Reports', 'Controls']) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('Employees');
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

  it('connects assigned branches to the selected branch workspace', () => {
    const html = renderToStaticMarkup(<RetailModulePanel section="branches" organizationSlug="uk-super" branchId="branch-1" branches={[{ id: 'branch-1', name: 'Headquarters' }, { id: 'branch-2', name: 'Town Centre' }]} />);

    expect(html).toContain('Currently selected');
    expect(html).toContain('Headquarters');
    expect(html).toContain('href="/w/uk-super/retail?branch=branch-2"');
    expect(html).toContain('Switch to branch');
  });

  it('connects Reports to live branch dashboard totals and inventory', () => {
    const html = renderToStaticMarkup(<RetailModulePanel section="reports" organizationSlug="uk-super" products={[{ id: 'product-1', name: 'Milk', sku: 'MILK-1', barcode: null, selling_price: 450, quantity: 12 }]} dashboard={{ salesToday: 3, grossSalesToday: 1350, itemsSoldToday: 3, activeProducts: 1, lowStockProducts: 0, pendingDraftReviews: 2, currency: 'LKR' }} />);

    expect(html).toContain('Gross sales today');
    expect(html).toContain('LKR');
    expect(html).toContain('Pending product reviews');
    expect(html).toContain('1 active catalogue products');
    expect(html).toContain('href="/w/uk-super/retail"');
  });

  it('connects Controls to existing Team and Business Settings pages', () => {
    const html = renderToStaticMarkup(<RetailModulePanel section="controls" organizationSlug="uk-super" />);

    expect(html).toContain('href="/w/uk-super/settings/team"');
    expect(html).toContain('Open Team');
    expect(html).toContain('href="/w/uk-super/settings"');
    expect(html).toContain('Till reconciliation and a Retail audit activity screen are not part of the current data/actions.');
  });
});
