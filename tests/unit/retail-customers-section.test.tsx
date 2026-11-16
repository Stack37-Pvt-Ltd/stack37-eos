import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetailCustomersSection } from '../../src/components/tenant/retail-customers-section';

describe('Retail customers section', () => {
  it('shows a searchable name-only directory and add/edit controls to managers', () => {
    const html = renderToStaticMarkup(<RetailCustomersSection organizationId="10000000-0000-4000-8000-000000000001" canRead canManage writesEnabled />);
    expect(html).toContain('Search customers');
    expect(html).toContain('Search by customer name');
    expect(html).toContain('Add customer</button>');
    expect(html).toContain('Customer name');
    expect(html).not.toContain('Email');
    expect(html).not.toContain('Phone');
  });

  it('keeps preview customer records read-only while allowing search', () => {
    const html = renderToStaticMarkup(<RetailCustomersSection organizationId="10000000-0000-4000-8000-000000000001" canRead canManage writesEnabled={false} />);
    expect(html).toContain('Preview changes are read-only');
    expect(html).toContain('Search customers');
    expect(html).not.toContain('Add customer</button>');
  });

  it('does not reveal the directory to a role without customer read permission', () => {
    const html = renderToStaticMarkup(<RetailCustomersSection organizationId="10000000-0000-4000-8000-000000000001" canRead={false} canManage={false} writesEnabled={false} />);
    expect(html).toContain('Customer access is not assigned');
    expect(html).not.toContain('Search customers');
  });
});
