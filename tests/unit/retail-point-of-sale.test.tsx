import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetailPointOfSale } from '../../src/components/tenant/retail-point-of-sale';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const product = {
  id: '30000000-0000-4000-8000-000000000003',
  name: 'Milk',
  sku: 'MILK-1',
  barcode: '4791234567890',
  selling_price: 100,
  quantity: 5,
};

describe('Retail point of sale', () => {
  it('renders scanner, customer contact, discount, split tender and printable receipt affordances', () => {
    const html = renderToStaticMarkup(<RetailPointOfSale
      organizationId="10000000-0000-4000-8000-000000000001"
      branchId="20000000-0000-4000-8000-000000000002"
      organizationName="UK Super"
      branchName="Main Branch"
      products={[product]}
      currency="LKR"
      salesPermission
      settingsHref="/w/uk-super/settings"
      uberCommissionRate={null}
      pickmeCommissionRate={null}
    />);

    expect(html).toContain('Scan a product barcode and press Enter');
    expect(html).toContain('Customer details (optional)');
    expect(html).toContain('Add a customer to this receipt');
    expect(html).not.toContain('Customer name');
    expect(html).not.toContain('Phone number');
    expect(html).toContain('max="20"');
    expect(html).toContain('Uber');
    expect(html).toContain('PickMe');
    expect(html).toContain('Add split payment');
    expect(html).toContain('Complete sale &amp; print receipt');
    expect(html).toContain('prints a sales receipt');
  });
});
