import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../src/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.authGetUser },
    from: mocks.from,
    rpc: mocks.rpc,
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { adjustInventoryAction, recordRetailSaleAction, upsertRetailCustomerAction } from '../../src/lib/actions/retail';

const orgId = '10000000-0000-4000-8000-000000000001';
const branchId = '20000000-0000-4000-8000-000000000002';
const customerId = '50000000-0000-4000-8000-000000000005';
const productId = '30000000-0000-4000-8000-000000000003';

function makeLookupBuilder(data: unknown) {
  const builder: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'order', 'limit', 'ilike', 'in']) {
    builder[key] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => ({ data, error: null }));
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return builder;
}

describe('retail customer actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.from.mockImplementation((table: string) => makeLookupBuilder(
      table === 'organization_members' ? { id: 'membership-1', status: 'active' } : { slug: 'uk-super' },
    ));
  });

  it('passes the optional customer to the atomic sale RPC after checking the active member', async () => {
    mocks.rpc.mockResolvedValue({ data: { saleId: 'sale-1', receiptNumber: 'UKS-1', total: 100, replayed: false }, error: null });

    const result = await recordRetailSaleAction({
      organizationId: orgId,
      branchId,
      customerId,
      idempotencyKey: '40000000-0000-4000-8000-000000000004',
      paymentMethod: 'cash',
      lines: [{ productId, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(mocks.authGetUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('record_retail_sale_with_customer', expect.objectContaining({
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_customer_id: customerId,
    }));
  });

  it('uses the tenant checked customer upsert RPC and returns a safe error on failure', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: customerId, name: 'A Customer', createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z' }, error: null });
    const saved = await upsertRetailCustomerAction({ organizationId: orgId, name: 'A Customer' });
    expect(saved.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('upsert_retail_customer', {
      p_organization_id: orgId,
      p_customer_id: null,
      p_name: 'A Customer',
    });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'database-private-details' } });
    const failed = await upsertRetailCustomerAction({ organizationId: orgId, name: 'Other Customer' });
    expect(failed.success).toBe(false);
    expect(failed.error).not.toContain('database-private-details');
  });

  it('allows approved customer/POS mutations in Preview while keeping stock adjustments blocked', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    mocks.rpc.mockResolvedValue({ data: { id: customerId, name: 'Preview Customer', createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z' }, error: null });

    const customer = await upsertRetailCustomerAction({ organizationId: orgId, name: 'Preview Customer' });
    expect(customer.success).toBe(true);

    mocks.rpc.mockResolvedValue({ data: { saleId: 'sale-preview', receiptNumber: 'UKS-2', total: 100, replayed: false }, error: null });
    const sale = await recordRetailSaleAction({
      organizationId: orgId,
      branchId,
      customerId,
      idempotencyKey: '60000000-0000-4000-8000-000000000006',
      paymentMethod: 'cash',
      lines: [{ productId, quantity: 1 }],
    });
    expect(sale.success).toBe(true);

    const adjustment = await adjustInventoryAction({ organizationId: orgId, branchId, productId, quantityDelta: -1, reason: 'Preview test' });
    expect(adjustment.success).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
