import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  updateBusinessConfigurationAction,
  updateBranchConfigurationAction,
} from '../../src/lib/actions/organization';
import { getBusinessConfiguration } from '../../src/lib/auth/business-config';
import { verifyTenantAccess } from '../../src/lib/auth/tenant-guard';
import { confirmOtpAction, resetPasswordAction } from '../../src/lib/actions/auth';
import { createRecoveryToken, RECOVERY_COOKIE_NAME } from '../../src/lib/auth/recovery-token';
import proxy from '../../src/proxy';
import * as supabaseServerModule from '../../src/lib/supabase/server';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock cookies for auth tests
const mockCookieMap = new Map<string, string>();
const mockCookieStore = {
  get: (name: string) => (mockCookieMap.has(name) ? { name, value: mockCookieMap.get(name)! } : undefined),
  set: (name: string, value: string) => {
    mockCookieMap.set(name, value);
  },
  delete: (name: string) => {
    mockCookieMap.delete(name);
  },
  getAll: () => Array.from(mockCookieMap.entries()).map(([name, value]) => ({ name, value })),
};

let currentHost = 'mybusiness.localhost:3000';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(() =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'host') return currentHost;
        if (key === 'x-forwarded-proto') return 'http';
        return null;
      },
    })
  ),
  cookies: vi.fn().mockImplementation(() => Promise.resolve(mockCookieStore)),
}));

describe('TASK-STAB-005B: Targeted Backend Security Safeguards & Invariant Tests', () => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockVerifyOtp = vi.fn();
  const mockUpdateUser = vi.fn();

  const mockSupabase = {
    auth: {
      getUser: mockGetUser,
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieMap.clear();
    currentHost = 'mybusiness.localhost:3000';

    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof supabaseServerModule.createClient> extends Promise<infer U> ? U : never
    );
  });

  // =========================================================================
  // SCENARIO 1: Cross-Organization Isolation & Private Data Protection
  // =========================================================================
  describe('Scenario 1: Cross-Organization Isolation', () => {
    const orgBId = 'b0000000-0000-4000-a000-000000000002';
    const userA = { id: 'user-a-uuid', email: 'owner-a@company-a.com' };

    it('strictly rejects updateBusinessConfigurationAction when a user from Org A targets Org B', async () => {
      mockGetUser.mockResolvedValue({ data: { user: userA }, error: null });

      // User A queries organization_members for Org B -> returns null (not a member of Org B)
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await updateBusinessConfigurationAction({
        organizationId: orgBId, // Targeting Org B
        name: 'Malicious Rename',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify business settings.');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('strictly rejects updateBranchConfigurationAction when a user from Org A targets a branch in Org B', async () => {
      mockGetUser.mockResolvedValue({ data: { user: userA }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await updateBranchConfigurationAction({
        organizationId: orgBId,
        branchId: 'c0000000-0000-4000-a000-000000000003',
        name: 'Hijacked Branch',
        code: 'HQ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify branch details.');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('resolves canEdit=false when getBusinessConfiguration is accessed with a foreign membership', async () => {
      const mockOrg = {
        id: orgBId,
        name: 'Company B',
        slug: 'company-b',
        currency: 'USD',
        timezone: 'America/New_York',
        country_code: 'US',
      };

      const chainableBuilder: Record<string, unknown> = {};
      chainableBuilder.eq = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.order = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.limit = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue(chainableBuilder),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue(chainableBuilder),
          };
        }
        if (table === 'business_categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const data = await getBusinessConfiguration(orgBId, 'membership-from-org-a');

      expect(data).not.toBeNull();
      expect(data?.canEdit).toBe(false); // Read-only view enforced
    });

    it('resolves canEdit=false when getBusinessConfiguration is called without userMembershipId (fail-closed default)', async () => {
      const mockOrg = {
        id: orgBId,
        name: 'Company B',
        slug: 'company-b',
        currency: 'USD',
        timezone: 'America/New_York',
        country_code: 'US',
      };

      const chainableBuilder: Record<string, unknown> = {};
      chainableBuilder.eq = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.order = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.limit = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return { select: vi.fn().mockReturnValue(chainableBuilder) };
        }
        if (table === 'business_categories') {
          return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {};
      });

      const data = await getBusinessConfiguration(orgBId);
      expect(data).not.toBeNull();
      expect(data?.canEdit).toBe(false);
    });

    it('resolves canEdit=false when member is suspended in getBusinessConfiguration', async () => {
      const mockOrg = {
        id: orgBId,
        name: 'Company B',
        slug: 'company-b',
        currency: 'USD',
        timezone: 'America/New_York',
        country_code: 'US',
      };

      const chainableBuilder: Record<string, unknown> = {};
      chainableBuilder.eq = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.order = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.limit = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return { select: vi.fn().mockReturnValue(chainableBuilder) };
        }
        if (table === 'organization_members') {
          const memQuery: Record<string, unknown> = {};
          memQuery.eq = vi.fn().mockReturnValue(memQuery);
          memQuery.maybeSingle = vi.fn().mockResolvedValue({
            data: { is_owner: true, status: 'suspended', organization_id: orgBId },
            error: null,
          });
          return { select: vi.fn().mockReturnValue(memQuery) };
        }
        if (table === 'business_categories') {
          return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {};
      });

      const data = await getBusinessConfiguration(orgBId, 'membership-suspended');
      expect(data).not.toBeNull();
      expect(data?.canEdit).toBe(false);
    });

    it('resolves canEdit=false when member is not an owner in getBusinessConfiguration', async () => {
      const mockOrg = {
        id: orgBId,
        name: 'Company B',
        slug: 'company-b',
        currency: 'USD',
        timezone: 'America/New_York',
        country_code: 'US',
      };

      const chainableBuilder: Record<string, unknown> = {};
      chainableBuilder.eq = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.order = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.limit = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return { select: vi.fn().mockReturnValue(chainableBuilder) };
        }
        if (table === 'organization_members') {
          const memQuery: Record<string, unknown> = {};
          memQuery.eq = vi.fn().mockReturnValue(memQuery);
          memQuery.maybeSingle = vi.fn().mockResolvedValue({
            data: { is_owner: false, status: 'active', organization_id: orgBId },
            error: null,
          });
          return { select: vi.fn().mockReturnValue(memQuery) };
        }
        if (table === 'business_categories') {
          return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {};
      });

      const data = await getBusinessConfiguration(orgBId, 'membership-staff');
      expect(data).not.toBeNull();
      expect(data?.canEdit).toBe(false);
    });

    it('resolves canEdit=true when caller is verified active Primary Owner belonging to requested organization', async () => {
      const mockOrg = {
        id: orgBId,
        name: 'Company B',
        slug: 'company-b',
        currency: 'USD',
        timezone: 'America/New_York',
        country_code: 'US',
      };

      const chainableBuilder: Record<string, unknown> = {};
      chainableBuilder.eq = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.order = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.limit = vi.fn().mockReturnValue(chainableBuilder);
      chainableBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return { select: vi.fn().mockReturnValue(chainableBuilder) };
        }
        if (table === 'organization_members') {
          const memQuery: Record<string, unknown> = {};
          memQuery.eq = vi.fn().mockReturnValue(memQuery);
          memQuery.maybeSingle = vi.fn().mockResolvedValue({
            data: { is_owner: true, status: 'active', organization_id: orgBId },
            error: null,
          });
          return { select: vi.fn().mockReturnValue(memQuery) };
        }
        if (table === 'business_categories') {
          return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {};
      });

      const data = await getBusinessConfiguration(orgBId, 'membership-owner-valid');
      expect(data).not.toBeNull();
      expect(data?.canEdit).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 2: Non-Owner Permission Enforcement on Business Settings
  // =========================================================================
  describe('Scenario 2: Non-Owner Permission Enforcement', () => {
    const orgId = 'a0000000-0000-4000-a000-000000000001';
    const adminUser = { id: 'admin-user-uuid', email: 'admin@company.com' };

    it('blocks administrators who are not Primary Owner from updating Business Settings', async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser }, error: null });

      // User has active membership but is_owner is false
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-admin', is_owner: false, status: 'active' },
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

      const result = await updateBusinessConfigurationAction({
        organizationId: orgId,
        name: 'Unauthorized Edit',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify business settings.');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('blocks non-owner staff from updating Headquarters branch configuration', async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-admin', is_owner: false, status: 'active' },
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

      const result = await updateBranchConfigurationAction({
        organizationId: orgId,
        branchId: 'b0000000-0000-4000-a000-000000000001',
        name: 'Staff Branch',
        code: 'HQ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify branch details.');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SCENARIO 3: Suspended User Workspace Lockout
  // =========================================================================
  describe('Scenario 3: Suspended User Workspace Lockout', () => {
    const orgId = 'a0000000-0000-4000-a000-000000000001';
    const suspendedUser = { id: 'suspended-user-uuid', email: 'suspended@company.com' };

    it('rejects suspended users from invoking updateBusinessConfigurationAction', async () => {
      mockGetUser.mockResolvedValue({ data: { user: suspendedUser }, error: null });

      // Action specifically queries .eq('status', 'active'), so suspended row returns null
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await updateBusinessConfigurationAction({
        organizationId: orgId,
        name: 'Suspended Attempt',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify business settings.');
    });

    it('strictly returns reason="suspended" in verifyTenantAccess for suspended staff', async () => {
      mockGetUser.mockResolvedValue({ data: { user: suspendedUser }, error: null });

      const mockOrg = { id: orgId, name: 'Acme Corp', slug: 'acme', provisioning_status: 'completed' };
      const mockMember = { id: 'mem-susp', is_owner: false, status: 'suspended' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await verifyTenantAccess('acme');
      expect(result.authorized).toBe(false);
      if (!result.authorized && result.reason === 'suspended') {
        expect(result.organizationName).toBe('Acme Corp');
        expect(result.user.id).toBe(suspendedUser.id);
      } else {
        expect.unreachable('Expected reason="suspended"');
      }
    });
  });

  // =========================================================================
  // SCENARIO 4: Invalid, Expired, and Tampered Auth & Recovery States
  // =========================================================================
  describe('Scenario 4: Authentication & Recovery Tamper Defenses', () => {
    it('rejects resetPasswordAction when sb-recovery-token cookie is completely absent', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-reset-uuid' } },
        error: null,
      });

      const result = await resetPasswordAction({
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Password reset requires a verified recovery session from your email link.');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects resetPasswordAction when recovery token is expired', async () => {
      const userId = 'user-reset-uuid';
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      // Generate token that expired 60 seconds ago
      const expiredToken = createRecoveryToken(userId, -60);
      mockCookieMap.set(RECOVERY_COOKIE_NAME, expiredToken);

      const result = await resetPasswordAction({
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Password reset requires a verified recovery session from your email link.');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects resetPasswordAction when recovery token was issued for a different user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'victim-user-id' } },
        error: null,
      });

      // Token generated for attacker user ID
      const attackerToken = createRecoveryToken('attacker-user-id', 900);
      mockCookieMap.set(RECOVERY_COOKIE_NAME, attackerToken);

      const result = await resetPasswordAction({
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Password reset requires a verified recovery session from your email link.');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects confirmOtpAction when host origin is unapproved', async () => {
      currentHost = 'malicious-phishing-domain.com';

      const result = await confirmOtpAction({
        tokenHash: 'valid-token-hash-123',
        type: 'signup',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad Request: Invalid confirmation host origin.');
    });

    it('rejects confirmOtpAction when tokenHash is empty or whitespace', async () => {
      const result = await confirmOtpAction({
        tokenHash: '   ',
        type: 'signup',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or missing confirmation token.');
    });
  });

  // =========================================================================
  // SCENARIO 5: Workspace URL Routing & Reserved Subdomain Protection
  // =========================================================================
  describe('Scenario 5: Workspace URL Routing Restrictions', () => {
    it('strictly returns 404 for direct access to internal /tenant routes', async () => {
      const req = new NextRequest('http://acme.localhost:3000/tenant/acme/settings', {
        headers: { host: 'acme.localhost:3000' },
      });
      const res = await proxy(req);

      expect(res.status).toBe(404);
    });

    it('strictly returns 404 for reserved subdomains in proxy (admin, api, auth, app, www)', async () => {
      const reserved = ['admin', 'api', 'auth', 'app', 'www'];
      for (const sub of reserved) {
        const req = new NextRequest(`http://${sub}.localhost:3000/`, {
          headers: { host: `${sub}.localhost:3000` },
        });
        const res = await proxy(req);
        expect(res.status).toBe(404);
      }
    });

    it('strips client-injected x-tenant-slug header to prevent identity forgery', async () => {
      const req = new NextRequest('http://acme.localhost:3000/settings', {
        headers: {
          host: 'acme.localhost:3000',
          'x-tenant-slug': 'forged-target-tenant',
        },
      });
      await proxy(req);

      // Verify that the proxy deletes x-tenant-slug header
      expect(req.headers.get('x-tenant-slug')).toBeNull();
    });

    it('returns not_a_member when tenantSlug is whitespace in verifyTenantAccess', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@example.com' } },
        error: null,
      });

      const result = await verifyTenantAccess('   ');
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.reason).toBe('not_a_member');
      }
    });
  });

  // =========================================================================
  // SCENARIO 6: Business Configuration Schema & Audit Invariants
  // =========================================================================
  describe('Scenario 6: Business Configuration Schema Invariants', () => {
    const validOrgId = 'a0000000-0000-4000-a000-000000000001';

    it('rejects unsupported currency ISO codes before executing database mutations', async () => {
      const result = await updateBusinessConfigurationAction({
        organizationId: validOrgId,
        name: 'Valid Name',
        currency: 'BITCOIN', // Invalid (must be 3-letter ISO code)
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors?.currency).toBeDefined();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects invalid country codes that do not conform to 2-letter ISO standards', async () => {
      const result = await updateBusinessConfigurationAction({
        organizationId: validOrgId,
        name: 'Valid Name',
        currency: 'USD',
        timezone: 'UTC',
        countryCode: 'USA', // Invalid (must be 2 letters, e.g. US)
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors?.countryCode).toBeDefined();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects empty or whitespace branch names in updateBranchConfigurationAction', async () => {
      const result = await updateBranchConfigurationAction({
        organizationId: validOrgId,
        branchId: 'b0000000-0000-4000-a000-000000000001',
        name: '  ',
        code: 'HQ',
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors?.name).toBeDefined();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
