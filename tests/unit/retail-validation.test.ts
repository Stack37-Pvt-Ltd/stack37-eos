import { describe, expect, it } from 'vitest';
import { AdjustInventorySchema, CompleteRetailCheckoutSchema, SearchRetailCustomersSchema, UpdateRetailCommissionRatesSchema, UpsertRetailCustomerSchema } from '../../src/lib/validations/retail';

const ids = {
  organizationId: '10000000-0000-4000-8000-000000000001',
  branchId: '20000000-0000-4000-8000-000000000002',
  idempotencyKey: '40000000-0000-4000-8000-000000000004',
  customer: { name: 'Alice', phone: '+94 77 123 4567' },
  discountPercent: 10,
  tenders: [{ method: 'cash' as const, amount: 90 }],
  lines: [{ productId: '30000000-0000-4000-8000-000000000003', quantity: 1 }],
};

describe('retail operation validation', () => {
  it('accepts fractional-weight items and a split payment using valid cashier methods', () => {
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, discountPercent: 0, tenders: [
      { method: 'cash', amount: 50 }, { method: 'uber', amount: 50 },
    ] }).success).toBe(true);
  });

  it('rejects checkout quantities that database stock precision would round', () => {
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, lines: [{ productId: '30000000-0000-4000-8000-000000000003', quantity: 0.0001 }] }).success).toBe(false);
  });

  it('rejects an empty basket and unsupported payment method', () => {
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, lines: [] }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, tenders: [{ method: 'gift_card', amount: 100 }] }).success).toBe(false);
  });

  it('requires a valid customer and limits cashier discounts to 20 percent', () => {
    expect(CompleteRetailCheckoutSchema.safeParse(ids).success).toBe(true);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, customer: null }).success).toBe(true);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, discountPercent: 20.01 }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, discountPercent: 20.001 }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, customer: { name: '', phone: '12345' } }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, customer: { name: 'Alice', phone: '077 123 4567' } }).success).toBe(true);
  });

  it('rejects duplicate tender methods, zero amounts and too many decimal places', () => {
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, tenders: [
      { method: 'cash', amount: 50 }, { method: 'cash', amount: 50 },
    ] }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, tenders: [{ method: 'card', amount: 0 }] }).success).toBe(false);
    expect(CompleteRetailCheckoutSchema.safeParse({ ...ids, tenders: [{ method: 'card', amount: 10.001 }] }).success).toBe(false);
  });

  it('accepts unset or precise provider rates and rejects percentages outside the range', () => {
    expect(UpdateRetailCommissionRatesSchema.safeParse({ organizationId: ids.organizationId, uberCommissionRate: '', pickmeCommissionRate: '' }).success).toBe(true);
    expect(UpdateRetailCommissionRatesSchema.safeParse({ organizationId: ids.organizationId, uberCommissionRate: '10', pickmeCommissionRate: '12.5' }).success).toBe(true);
    expect(UpdateRetailCommissionRatesSchema.safeParse({ organizationId: ids.organizationId, uberCommissionRate: '100.01', pickmeCommissionRate: '12.5' }).success).toBe(false);
    expect(UpdateRetailCommissionRatesSchema.safeParse({ organizationId: ids.organizationId, uberCommissionRate: '10.123', pickmeCommissionRate: '12.5' }).success).toBe(false);
  });

  it('validates customer search and customer records with a phone number', () => {
    expect(SearchRetailCustomersSchema.safeParse({ organizationId: ids.organizationId, query: 'Alice', limit: 100 }).success).toBe(true);
    expect(SearchRetailCustomersSchema.safeParse({ organizationId: ids.organizationId, query: 'x'.repeat(161) }).success).toBe(false);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: 'Alice', phone: '077 123 4567' }).success).toBe(true);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: '  ', phone: '0771234567' }).success).toBe(false);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: 'Alice', phone: '0771234567', email: 'alice@example.com' }).success).toBe(false);
  });

  it('requires a non-zero stock adjustment with a reason', () => {
    const adjustment = { organizationId: ids.organizationId, branchId: ids.branchId, productId: '30000000-0000-4000-8000-000000000003' };
    expect(AdjustInventorySchema.safeParse({ ...adjustment, quantityDelta: 2, reason: 'Physical count' }).success).toBe(true);
    expect(AdjustInventorySchema.safeParse({ ...adjustment, quantityDelta: 0, reason: 'Count' }).success).toBe(false);
    expect(AdjustInventorySchema.safeParse({ ...adjustment, quantityDelta: 0.0001, reason: 'Count' }).success).toBe(false);
  });
});
