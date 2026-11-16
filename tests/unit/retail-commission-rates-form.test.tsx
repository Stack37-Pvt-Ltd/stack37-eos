import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetailCommissionRatesForm } from '../../src/components/tenant/retail-commission-rates-form';

describe('Retail commission settings', () => {
  it('leaves provider rates unset and explains that they do not change customer prices', () => {
    const html = renderToStaticMarkup(<RetailCommissionRatesForm
      organizationId="10000000-0000-4000-8000-000000000001"
      canEdit
      uberRate={null}
      pickmeRate={null}
    />);

    expect(html).toContain('Uber commission (%)');
    expect(html).toContain('PickMe commission (%)');
    expect(html.match(/placeholder="Not set"/g)).toHaveLength(2);
    expect(html).toContain('Example only: a 10% commission');
    expect(html).toContain('does not add a fee to the customer’s bill');
  });

  it('shows saved settings to non-owner members without a save control', () => {
    const html = renderToStaticMarkup(<RetailCommissionRatesForm
      organizationId="10000000-0000-4000-8000-000000000001"
      canEdit={false}
      uberRate={10}
      pickmeRate={12.5}
    />);

    expect(html).toContain('Only the Primary Owner can change these rates.');
    expect(html).toContain('value="10"');
    expect(html).toContain('value="12.5"');
    expect(html).not.toContain('Save provider rates');
  });
});
