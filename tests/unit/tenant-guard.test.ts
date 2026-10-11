import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyTenantAccess,
  getUserOrganizations,
  getTenantWorkspaceUrl,
} from '../../src/lib/auth/tenant-guard';
import * as supabaseServerModule from '../../src/lib/supabase/server';

describe('Server-Side Tenant Membership Guard & Multi-Organization Management', () => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();

  const mockSupabase = {
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof supabaseServerModule.createClient> extends Promise<infer U> ? U : never
    );
  });

  describe('verifyTenantAccess', () => {
    it('returns unauthenticated with sanitized login redirect when user session is missing', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });

      const result = await verifyTenantAccess('acmecorp', '/dashboard');

      expect(result.authorized).toBe(false);
      if (!result.authorized && result.reason === 'unauthenticated') {
        expect(result.redirectUrl).toBe('/login?next=%2Fdashboard');
      } else {
        expect.unreachable('Expected unauthenticated reason');
      }
    });

    it('sanitizes open-redirect attempts in unauthenticated return path', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await verifyTenantAccess('acmecorp', 'https://malicious.com');

      expect(result.authorized).toBe(false);
      if (!result.authorized && result.reason === 'unauthenticated') {
        expect(result.redirectUrl).toBe('/login?next=%2F');
      }
    });

    it('returns not_a_member when organization does not exist or RLS hides it', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@example.com' } },
        error: null,
      });

      // organizations table query returns null (RLS filtered or non-existent)
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await verifyTenantAccess('unauthorized-org');

      expect(result.authorized).toBe(false);
      if (!result.authorized && result.reason === 'not_a_member') {
        expect(result.user.id).toBe('user-1');
        expect(result.user.email).toBe('user@example.com');
      } else {
        expect.unreachable('Expected not_a_member');
      }
    });

    it('strictly prevents suspended employees from entering workspace', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-suspended', email: 'suspended@company.com' } },
        error: null,
      });

      const mockOrg = {
        id: 'org-1',
        name: 'Acme Corporation',
        slug: 'acmecorp',
        provisioning_status: 'completed',
      };

      const mockSuspendedMember = {
        id: 'mem-1',
        is_owner: false,
        status: 'suspended',
      };

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
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSuspendedMember, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await verifyTenantAccess('acmecorp');

      expect(result.authorized).toBe(false);
      if (!result.authorized && result.reason === 'suspended') {
        expect(result.organizationName).toBe('Acme Corporation');
        expect(result.user.id).toBe('user-suspended');
      } else {
        expect.unreachable('Expected suspended reason');
      }
    });

    it('authorizes active member with full workspace context', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-active', email: 'owner@company.com' } },
        error: null,
      });

      const mockOrg = {
        id: 'org-1',
        name: 'Acme Corporation',
        slug: 'acmecorp',
        provisioning_status: 'completed',
      };

      const mockActiveMember = {
        id: 'mem-1',
        is_owner: true,
        status: 'active',
      };

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
            maybeSingle: vi.fn().mockResolvedValue({ data: mockActiveMember, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await verifyTenantAccess('acmecorp');

      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.context.organization.slug).toBe('acmecorp');
        expect(result.context.membership.is_owner).toBe(true);
        expect(result.context.membership.status).toBe('active');
        expect(result.context.user.email).toBe('owner@company.com');
      }
    });
  });

  describe('getUserOrganizations (Multi-Organization Support)', () => {
    it('returns empty list for unauthenticated user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const orgs = await getUserOrganizations();
      expect(orgs).toEqual([]);
    });

    it('returns all active organizations visible to the user under RLS', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-multi-org', email: 'lead@stack37.com' } },
        error: null,
      });

      const mockOrgs = [
        { id: 'org-1', name: 'Acme Corp', slug: 'acme', provisioning_status: 'completed' },
        { id: 'org-2', name: 'Beta Industries', slug: 'beta', provisioning_status: 'completed' },
      ];

      const mockMemberships = [
        { organization_id: 'org-1', is_owner: true, status: 'active' },
        { organization_id: 'org-2', is_owner: false, status: 'active' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockOrgs, error: null }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              return {
                eq: vi.fn().mockResolvedValue({ data: mockMemberships, error: null }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await getUserOrganizations();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('acme');
      expect(result[0].is_owner).toBe(true);
      expect(result[1].slug).toBe('beta');
      expect(result[1].is_owner).toBe(false);
    });
  });

  describe('getTenantWorkspaceUrl', () => {
    it('constructs correct local URL preserving port for local testing', () => {
      const url = getTenantWorkspaceUrl('acmecorp', 'mybusiness.localhost:3000');
      expect(url).toBe('http://acmecorp.localhost:3000/');
    });

    it('constructs correct production subdomain URL for stack37.com', () => {
      const url = getTenantWorkspaceUrl('acmecorp', 'mybusiness.stack37.com');
      expect(url).toBe('https://acmecorp.stack37.com/');
    });
  });
});
