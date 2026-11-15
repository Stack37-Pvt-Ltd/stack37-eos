import { describe, expect, it } from 'vitest';
import { AdjustInventorySchema, RecordRetailSaleSchema } from '../../src/lib/validations/retail';

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

  it('requires a non-zero stock adjustment with a reason', () => {
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 2, reason: 'Physical count' }).success).toBe(true);
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 0, reason: 'Count' }).success).toBe(false);
    expect(AdjustInventorySchema.safeParse({ ...ids, quantityDelta: 0.0001, reason: 'Count' }).success).toBe(false);
  });
});
