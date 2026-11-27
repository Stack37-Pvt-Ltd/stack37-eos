import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseServerModule from '../../src/lib/supabase/server';
import { resendStaffInvitationAction } from '../../src/lib/actions/team';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ host: 'mybusiness.localhost:3000' })),
}));

describe('resendStaffInvitationAction', () => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  const mockSupabase = {
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  };

  const orgId = '11111111-1111-4000-a000-000000000001';
  const inviteId = '44444444-4444-4000-a000-000000000001';
  const roleCashierId = '22222222-2222-4000-a000-000000000003';
  const branchHqId = '33333333-3333-4000-a000-000000000001';

  const ownerUser = { id: 'user-owner-uuid', email: 'owner@acme.com', user_metadata: { full_name: 'Store Owner' } };
  const regularUser = { id: 'user-regular-uuid', email: 'cashier@acme.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServerModule.createClient>>
    );
  });

  it('rejects unauthenticated caller', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await resendStaffInvitationAction(orgId, inviteId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication required/i);
  });

  it('rejects caller without team manager permissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: regularUser }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'mem-regular', is_owner: false, status: 'active' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'membership_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const result = await resendStaffInvitationAction(orgId, inviteId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it('rejects resending non-pending invitations', async () => {
    mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { is_owner: true, status: 'active', membership_roles: [] },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'invitations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: inviteId,
                    email: 'cashier@acme.com',
                    status: 'accepted',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const result = await resendStaffInvitationAction(orgId, inviteId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only pending invitations/i);
  });

  it('rotates invitation token via RPC and returns new invite URL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { is_owner: true, status: 'active', membership_roles: [] },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'invitations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: inviteId,
                    email: 'cashier@acme.com',
                    role_id: roleCashierId,
                    branch_id: branchHqId,
                    status: 'pending',
                    roles: { name: 'Cashier' },
                    branches: { name: 'Headquarters' },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: 'UK Super', slug: 'uk-super' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const rotatedInviteId = '55555555-5555-4000-a000-000000000001';
    mockRpc.mockResolvedValue({ data: rotatedInviteId, error: null });

    const result = await resendStaffInvitationAction(orgId, inviteId);

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('create_invitation', expect.objectContaining({
      p_org_id: orgId,
      p_email: 'cashier@acme.com',
      p_role_id: roleCashierId,
      p_branch_id: branchHqId,
    }));
    expect(result.data?.inviteUrl).toMatch(/http:\/\/mybusiness\.localhost:3000\/invite\/accept\?token=/);
  });
});
