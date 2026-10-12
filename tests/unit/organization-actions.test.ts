import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBusinessAction } from '../../src/lib/actions/organization';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('../../src/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getUser: (...args: unknown[]) => mockGetUser(...args),
      },
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    })
  ),
}));

function createPlansMock(
  planData: { id: string; name: string } | null = { id: 'plan-standard-uuid', name: 'Standard' }
) {
  const queryBuilder: Record<string, unknown> = {};
  queryBuilder.eq = vi.fn().mockImplementation(() => queryBuilder);
  queryBuilder.order = vi.fn().mockReturnValue(queryBuilder);
  queryBuilder.limit = vi.fn().mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: planData, error: null });
  return {
    select: vi.fn().mockReturnValue(queryBuilder),
  };
}

describe('createBusinessAction Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests and prompts user to sign in', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No active session' },
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('You must be signed in');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects invalid inputs failing Zod schema without calling database', async () => {
    const result = await createBusinessAction({
      name: '', // Too short
      slug: 'a', // Too short
      countryCode: 'USA', // Invalid format
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Please correct the errors');
    expect(result.fieldErrors?.name).toBeDefined();
    expect(result.fieldErrors?.slug).toBeDefined();
    expect(result.fieldErrors?.countryCode).toBeDefined();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('rejects reserved slug without querying database', async () => {
    const result = await createBusinessAction({
      name: 'Admin Portal',
      slug: 'admin',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.slug).toContain('reserved');
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('rejects registration when no public subscription plan is configured', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    // Mock organizations check (slug not taken)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return createPlansMock(null);
      }
      return {};
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No public subscription plan is currently configured');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('successfully executes atomic create_business RPC and returns organization ID', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return createPlansMock({ id: 'plan-standard-uuid', name: 'Standard' });
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: 'org-created-uuid',
      error: null,
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(true);
    expect(result.data?.organizationId).toBe('org-created-uuid');
    expect(result.data?.slug).toBe('acme-logistics');
    expect(result.data?.planName).toBe('Standard');
    expect(result.data?.trialDays).toBe(7);
    expect(mockRpc).toHaveBeenCalledWith('create_business', {
      p_name: 'Acme Logistics',
      p_slug: 'acme-logistics',
      p_plan_id: 'plan-standard-uuid',
      p_country_code: 'US',
    });
  });

  it('handles idempotency safely: returns success if the user already owns this exact slug', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    // Slug already exists and belongs to user-123
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'org-existing-uuid', slug: 'acme-logistics' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-123', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(true);
    expect(result.data?.organizationId).toBe('org-existing-uuid');
    expect(result.data?.planName).toBe('Standard');
    expect(result.data?.trialDays).toBe(7);
    expect(result.data?.message).toContain('already been created');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects registration with field error if slug belongs to another user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    // Slug exists but user-123 is NOT the owner
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'org-other-uuid', slug: 'acme-logistics' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // Not a member/owner
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('This workspace URL is already taken');
    expect(result.fieldErrors?.slug).toContain('already taken');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('catches concurrent unique constraint violation (23505) and returns clean slug error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return createPlansMock({ id: 'plan-standard-uuid', name: 'Standard' });
      }
      return {};
    });

    // Concurrent race condition: another transaction committed first
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "organizations_slug_key"',
      },
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('This workspace URL is already taken');
    expect(result.fieldErrors?.slug).toContain('already taken');
  });

  it('catches check constraint violation (23514) on slug format', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return createPlansMock({ id: 'plan-standard-uuid', name: 'Standard' });
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message: 'new row for relation "organizations" violates check constraint "slug_format"',
      },
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace URL contains invalid characters');
    expect(result.fieldErrors?.slug).toContain('invalid characters');
  });

  it('guarantees 7-day free trial policy on Standard plan without requiring payment details', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-777', email: 'director@enterprise.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return createPlansMock({ id: 'plan-standard-uuid', name: 'Standard' });
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: 'org-enterprise-uuid',
      error: null,
    });

    // Submitting with zero payment or credit card payload
    const result = await createBusinessAction({
      name: 'Enterprise Logistics',
      slug: 'enterprise-logistics',
      countryCode: 'LK',
    });

    expect(result.success).toBe(true);
    expect(result.data?.trialDays).toBe(7);
    expect(result.data?.planName).toBe('Standard');
    expect(result.data?.organizationId).toBe('org-enterprise-uuid');
    expect(mockRpc).toHaveBeenCalledWith('create_business', {
      p_name: 'Enterprise Logistics',
      p_slug: 'enterprise-logistics',
      p_plan_id: 'plan-standard-uuid',
      p_country_code: 'LK',
    });
  });

  it('deterministically selects the Standard trial plan even when multiple public plans exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'owner@acme.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        let queriedPlanName: string | null = null;
        const qb: Record<string, unknown> = {};
        qb.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
          if (col === 'name') queriedPlanName = val as string;
          return qb;
        });
        qb.order = vi.fn().mockReturnValue(qb);
        qb.limit = vi.fn().mockReturnValue(qb);
        qb.maybeSingle = vi.fn().mockImplementation(() => {
          // If queried by name = 'Standard', return Standard
          if (queriedPlanName === 'Standard') {
            return Promise.resolve({
              data: { id: 'plan-standard-uuid', name: 'Standard' },
              error: null,
            });
          }
          // If queried by order by price (fallback), would have returned Starter
          return Promise.resolve({
            data: { id: 'plan-starter-uuid', name: 'Starter' },
            error: null,
          });
        });
        return { select: vi.fn().mockReturnValue(qb) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: 'org-created-uuid',
      error: null,
    });

    const result = await createBusinessAction({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      countryCode: 'US',
    });

    expect(result.success).toBe(true);
    expect(result.data?.planName).toBe('Standard');
    expect(mockRpc).toHaveBeenCalledWith('create_business', {
      p_name: 'Acme Logistics',
      p_slug: 'acme-logistics',
      p_plan_id: 'plan-standard-uuid', // Ensures Standard was selected, NOT Starter
      p_country_code: 'US',
    });
  });
});
