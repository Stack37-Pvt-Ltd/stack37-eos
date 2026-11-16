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

import { adjustInventoryAction, recordRetailSaleAction, updateRetailCommissionRatesAction, upsertRetailCustomerAction } from '../../src/lib/actions/retail';

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

  const checkoutInput = {
    organizationId: orgId,
    branchId,
    idempotencyKey: '40000000-0000-4000-8000-000000000004',
    discountPercent: 10,
    customer: { name: 'A Customer', phone: '+94 77 123 4567' },
    tenders: [{ method: 'cash' as const, amount: 90 }],
    lines: [{ productId, quantity: 1 }],
  };

  it('passes validated checkout details to the atomic sale RPC after checking active membership', async () => {
    mocks.rpc.mockResolvedValue({ data: { saleId: 'sale-1', receiptNumber: 'UKS-1', total: 90, replayed: false }, error: null });

    const result = await recordRetailSaleAction(checkoutInput);

    expect(result.success).toBe(true);
    expect(mocks.authGetUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('complete_retail_checkout', expect.objectContaining({
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_discount_percent: 10,
      p_customer_name: 'A Customer',
      p_customer_phone: '+94771234567',
      p_tenders: [{ method: 'cash', amount: 90 }],
      p_lines: [{ product_id: productId, quantity: 1 }],
    }));
  });

  it('saves provider commission rates only for an active Primary Owner', async () => {
    mocks.from.mockImplementation((table: string) => makeLookupBuilder(
      table === 'organization_members' ? { id: 'membership-1', status: 'active', is_owner: true } : { slug: 'uk-super' },
    ));
    mocks.rpc.mockResolvedValue({ data: { saved: true }, error: null });
    const result = await updateRetailCommissionRatesAction({ organizationId: orgId, uberCommissionRate: '10', pickmeCommissionRate: '12.5' });
    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('update_retail_commission_rates', {
      p_organization_id: orgId,
      p_uber_commission_rate: 10,
      p_pickme_commission_rate: 12.5,
    });

    mocks.from.mockImplementation((table: string) => makeLookupBuilder(
      table === 'organization_members' ? { id: 'membership-1', status: 'active', is_owner: false } : { slug: 'uk-super' },
    ));
    const denied = await updateRetailCommissionRatesAction({ organizationId: orgId, uberCommissionRate: '10', pickmeCommissionRate: '' });
    expect(denied.success).toBe(false);
  });

  it('uses the tenant checked customer upsert RPC and returns a safe error on failure', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: customerId, name: 'A Customer', phone: '+94771234567', createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z' }, error: null });
    const saved = await upsertRetailCustomerAction({ organizationId: orgId, name: 'A Customer', phone: '077 123 4567' });
    expect(saved.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('upsert_retail_customer', {
      p_organization_id: orgId,
      p_customer_id: null,
      p_name: 'A Customer',
      p_phone: '0771234567',
    });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'database-private-details' } });
    const failed = await upsertRetailCustomerAction({ organizationId: orgId, name: 'Other Customer', phone: '0771234567' });
    expect(failed.success).toBe(false);
    expect(failed.error).not.toContain('database-private-details');
  });

  it('allows approved customer/POS mutations in Preview while keeping stock adjustments blocked', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    mocks.rpc.mockResolvedValue({ data: { id: customerId, name: 'Preview Customer', phone: '+94771234567', createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z' }, error: null });

    const customer = await upsertRetailCustomerAction({ organizationId: orgId, name: 'Preview Customer', phone: '0771234567' });
    expect(customer.success).toBe(true);

    mocks.rpc.mockResolvedValue({ data: { saleId: 'sale-preview', receiptNumber: 'UKS-2', total: 90, replayed: false }, error: null });
    const sale = await recordRetailSaleAction({ ...checkoutInput, idempotencyKey: '60000000-0000-4000-8000-000000000006' });
    expect(sale.success).toBe(true);

    const adjustment = await adjustInventoryAction({ organizationId: orgId, branchId, productId, quantityDelta: -1, reason: 'Preview test' });
    expect(adjustment.success).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
