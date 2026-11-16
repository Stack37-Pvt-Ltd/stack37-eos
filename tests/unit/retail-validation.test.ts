import { describe, expect, it } from 'vitest';
import { AdjustInventorySchema, RecordRetailSaleSchema, SearchRetailCustomersSchema, UpsertRetailCustomerSchema } from '../../src/lib/validations/retail';

const ids = {
  organizationId: '10000000-0000-4000-8000-000000000001',
  branchId: '20000000-0000-4000-8000-000000000002',
  productId: '30000000-0000-4000-8000-000000000003',
  idempotencyKey: '40000000-0000-4000-8000-000000000004',
};

describe('retail operation validation', () => {
  it('accepts a fractional-weight checkout quantity up to three decimal places', () => {
    expect(RecordRetailSaleSchema.safeParse({ ...ids, paymentMethod: 'cash', lines: [{ productId: ids.productId, quantity: 0.125 }] }).success).toBe(true);
  });

  it('rejects checkout quantities that database stock precision would round', () => {
    expect(RecordRetailSaleSchema.safeParse({ ...ids, paymentMethod: 'cash', lines: [{ productId: ids.productId, quantity: 0.0001 }] }).success).toBe(false);
  });

  it('rejects an empty basket and unsupported payment method', () => {
    expect(RecordRetailSaleSchema.safeParse({ ...ids, paymentMethod: 'cash', lines: [] }).success).toBe(false);
    expect(RecordRetailSaleSchema.safeParse({ ...ids, paymentMethod: 'gift_card', lines: [{ productId: ids.productId, quantity: 1 }] }).success).toBe(false);
  });

  it('accepts an optional tenant-validated POS customer association', () => {
    const sale = { ...ids, paymentMethod: 'cash', lines: [{ productId: ids.productId, quantity: 1 }] };
    expect(RecordRetailSaleSchema.safeParse({ ...sale, customerId: '50000000-0000-4000-8000-000000000005' }).success).toBe(true);
    expect(RecordRetailSaleSchema.safeParse({ ...sale, customerId: 'not-a-uuid' }).success).toBe(false);
    expect(RecordRetailSaleSchema.safeParse(sale).success).toBe(true);
  });

  it('validates customer search and name-only customer records', () => {
    expect(SearchRetailCustomersSchema.safeParse({ organizationId: ids.organizationId, query: 'Alice', limit: 100 }).success).toBe(true);
    expect(SearchRetailCustomersSchema.safeParse({ organizationId: ids.organizationId, query: 'x'.repeat(161) }).success).toBe(false);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: 'Alice' }).success).toBe(true);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: '  ' }).success).toBe(false);
    expect(UpsertRetailCustomerSchema.safeParse({ organizationId: ids.organizationId, name: 'Alice', email: 'alice@example.com' }).success).toBe(false);
  });

  it('requires a non-zero stock adjustment with a reason', () => {
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 2, reason: 'Physical count' }).success).toBe(true);
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 0, reason: 'Count' }).success).toBe(false);
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 0.0001, reason: 'Count' }).success).toBe(false);
  });
});
