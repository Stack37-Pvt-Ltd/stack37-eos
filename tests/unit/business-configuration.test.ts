import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateBusinessConfigurationSchema,
  updateBranchConfigurationSchema,
  SUPPORTED_CURRENCIES,
  COMMON_TIMEZONES,
  TAX_STATUSES,
} from '../../src/lib/validations/organization';
import {
  updateBusinessConfigurationAction,
  updateBranchConfigurationAction,
} from '../../src/lib/actions/organization';
import { getBusinessConfiguration } from '../../src/lib/auth/business-config';
import * as supabaseServerModule from '../../src/lib/supabase/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Phase 3C.3: Business Setup & Configuration (Mocked Unit Tests)', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockGetUser = vi.fn();

  const mockSupabase = {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: mockGetUser,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof supabaseServerModule.createClient> extends Promise<infer U> ? U : never
    );
  });

  describe('Validation Schemas', () => {
    const validOrgId = 'a0000000-0000-4000-a000-000000000001';
    const validBranchId = 'b0000000-0000-4000-a000-000000000001';
    const validCategoryId = 'c0000000-0000-4000-a000-000000000001';

    it('verifies standard constants export required currencies, timezones, and tax statuses', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('LKR');
      expect(COMMON_TIMEZONES).toContain('UTC');
      expect(COMMON_TIMEZONES).toContain('Asia/Colombo');
      expect(TAX_STATUSES).toContain('standard');
      expect(TAX_STATUSES).toContain('vat_registered');
    });

    it('accepts valid full business configuration payload', () => {
      const payload = {
        organizationId: validOrgId,
        name: 'Acme Global Logistics',
        legalName: 'Acme Global Logistics (Pvt) Ltd',
        registrationNumber: 'PV-98765',
        categoryId: validCategoryId,
        contactEmail: 'contact@acmelogistics.com',
        contactPhone: '+94 11 234 5678',
        website: 'https://acmelogistics.com',
        addressLine1: '100 Galle Road',
        addressLine2: 'Level 5, Tower A',
        city: 'Colombo',
        stateProvince: 'Western Province',
        postalCode: '00300',
        countryCode: 'LK',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        taxId: 'VAT-123456789',
        taxStatus: 'vat_registered' as const,
      };

      const result = updateBusinessConfigurationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('LKR');
        expect(result.data.timezone).toBe('Asia/Colombo');
        expect(result.data.taxStatus).toBe('vat_registered');
      }
    });

    it('rejects invalid currency codes not conforming to 3-letter ISO format', () => {
      const payload = {
        organizationId: validOrgId,
        name: 'Acme Inc',
        currency: 'US_DOLLARS', // Invalid
        timezone: 'UTC',
      };

      const result = updateBusinessConfigurationSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('currency'))).toBe(true);
      }
    });

    it('rejects empty currency requiring explicit user selection', () => {
      const payload = {
        organizationId: validOrgId,
        name: 'Acme Inc',
        currency: '',
        timezone: 'UTC',
      };

      const result = updateBusinessConfigurationSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('currency'))).toBe(true);
      }
    });

    it('rejects invalid contact email formats', () => {
      const payload = {
        organizationId: validOrgId,
        name: 'Acme Inc',
        currency: 'USD',
        timezone: 'UTC',
        contactEmail: 'not-an-email',
      };

      const result = updateBusinessConfigurationSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('contactEmail'))).toBe(true);
      }
    });

    it('accepts valid branch configuration payload', () => {
      const branchPayload = {
        organizationId: validOrgId,
        branchId: validBranchId,
        name: 'Colombo Flagship',
        code: 'HQ',
        contactEmail: 'hq@acme.com',
        contactPhone: '+94 11 000 1111',
        addressLine1: '123 Galle Road',
        city: 'Colombo',
        postalCode: '00300',
      };

      const result = updateBranchConfigurationSchema.safeParse(branchPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Colombo Flagship');
        expect(result.data.code).toBe('HQ');
      }
    });

    it('enforces branch name minimum length constraint', () => {
      const branchPayload = {
        organizationId: validOrgId,
        branchId: validBranchId,
        name: 'A', // Too short (min 2)
        code: 'HQ',
      };

      const result = updateBranchConfigurationSchema.safeParse(branchPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true);
      }
    });
  });

  describe('Business Configuration Resolver (getBusinessConfiguration)', () => {
    const orgId = 'org-123';
    const memberId = 'mem-456';

    it('resolves configuration and headquarters branch correctly by is_headquarters flag even when renamed', async () => {
      const mockOrg = {
        id: orgId,
        name: 'Apex Holdings',
        slug: 'apex-holdings',
        legal_name: 'Apex Holdings PLC',
        registration_number: 'PQ-100',
        category_id: null,
        country_code: 'LK',
        created_at: '2026-10-12T10:00:00Z',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        tax_id: 'VAT-999',
        tax_status: 'vat_registered',
        contact_email: 'info@apex.lk',
        contact_phone: '+94 11 000 0000',
        website: 'https://apex.lk',
        address_line1: '1 Galle Face',
        address_line2: null,
        city: 'Colombo',
        state_province: 'Western',
        postal_code: '00100',
      };

      // Branch has been renamed from 'Headquarters' to 'Colombo Flagship'
      const mockBranch = {
        id: 'branch-hq-renamed',
        name: 'Colombo Flagship',
        organization_id: orgId,
        is_headquarters: true,
        code: 'HQ-LK',
        contact_email: 'flagship@apex.lk',
        contact_phone: '+94 11 555 5555',
        address_line1: '1 Galle Face',
        address_line2: null,
        city: 'Colombo',
        state_province: 'Western',
        postal_code: '00100',
      };

      const mockMember = { is_owner: true, status: 'active', organization_id: orgId };

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
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockBranch, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'membership_branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { branch_id: 'branch-hq-renamed' }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          const memQuery: Record<string, unknown> = {};
          memQuery.eq = vi.fn().mockReturnValue(memQuery);
          memQuery.maybeSingle = vi.fn().mockResolvedValue({ data: mockMember, error: null });
          return {
            select: vi.fn().mockReturnValue(memQuery),
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

      const data = await getBusinessConfiguration(orgId, memberId);

      expect(data).not.toBeNull();
      expect(data?.organization.name).toBe('Apex Holdings');
      expect(data?.organization.legalName).toBe('Apex Holdings PLC');
      expect(data?.organization.currency).toBe('LKR');
      expect(data?.organization.timezone).toBe('Asia/Colombo');
      // Verifies renamed branch is resolved reliably
      expect(data?.headquartersBranch?.id).toBe('branch-hq-renamed');
      expect(data?.headquartersBranch?.name).toBe('Colombo Flagship');
      expect(data?.headquartersBranch?.code).toBe('HQ-LK');
      expect(data?.headquartersBranch?.isOwnerAssigned).toBe(true);
      expect(data?.canEdit).toBe(true);
    });

    it('suggests LKR and Asia/Colombo without silent USD/UTC assignment for Sri Lankan organization', async () => {
      const lkUnconfiguredOrg = {
        id: orgId,
        name: 'Ceylon Tea Export',
        slug: 'ceylon-tea',
        category_id: null,
        country_code: 'LK',
        created_at: '2026-10-12T10:00:00Z',
        currency: null,
        timezone: null,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: lkUnconfiguredOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          const branchQueryBuilder: Record<string, unknown> = {};
          branchQueryBuilder.eq = vi.fn().mockReturnValue(branchQueryBuilder);
          branchQueryBuilder.order = vi.fn().mockReturnValue(branchQueryBuilder);
          branchQueryBuilder.limit = vi.fn().mockReturnValue(branchQueryBuilder);
          branchQueryBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

          return {
            select: vi.fn().mockReturnValue(branchQueryBuilder),
          };
        }
        if (table === 'organization_members') {
          const memQuery: Record<string, unknown> = {};
          memQuery.eq = vi.fn().mockReturnValue(memQuery);
          memQuery.maybeSingle = vi.fn().mockResolvedValue({
            data: { is_owner: true, status: 'active', organization_id: orgId },
            error: null,
          });
          return {
            select: vi.fn().mockReturnValue(memQuery),
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

      const data = await getBusinessConfiguration(orgId, memberId);

      expect(data).not.toBeNull();
      // Does NOT silently force USD/UTC
      expect(data?.organization.currency).toBe('');
      expect(data?.organization.timezone).toBe('');
      // Suggests regionally appropriate values
      expect(data?.organization.suggestedCurrency).toBe('LKR');
      expect(data?.organization.suggestedTimezone).toBe('Asia/Colombo');
    });
  });

  describe('Server Actions (Security & Audit Invariants)', () => {
    const validOrgId = 'a0000000-0000-4000-a000-000000000001';
    const validBranchId = 'b0000000-0000-4000-a000-000000000001';

    it('rejects updateBusinessConfigurationAction when user is unauthenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') });

      const result = await updateBusinessConfigurationAction({
        organizationId: validOrgId,
        name: 'New Name',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Authentication session expired/);
    });

    it('rejects updateBusinessConfigurationAction when user is not an owner', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-unauth' } }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1', is_owner: false, status: 'active' },
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
        organizationId: validOrgId,
        name: 'New Name',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify business settings.');
    });

    it('rejects updateBusinessConfigurationAction when user has administrator role but is not primary owner', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-admin' } }, error: null });

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
        organizationId: validOrgId,
        name: 'New Name',
        currency: 'USD',
        timezone: 'UTC',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Only the active primary owner can modify business settings.');
    });

    it('executes atomic update RPC successfully for authorized primary owner', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-owner' } }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1', is_owner: true, status: 'active' },
                      error: null,
                    }),
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
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'test' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await updateBusinessConfigurationAction({
        organizationId: validOrgId,
        name: 'Updated Business',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        legalName: 'Updated Business Ltd',
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toMatch(/Business configuration successfully saved/);
      expect(mockRpc).toHaveBeenCalledWith(
        'update_business_configuration',
        expect.objectContaining({
          p_organization_id: validOrgId,
          p_name: 'Updated Business',
          p_legal_name: 'Updated Business Ltd',
          p_currency: 'LKR',
          p_timezone: 'Asia/Colombo',
        })
      );
    });

    it('fails clearly and NEVER attempts direct table fallback when RPC is unavailable or errors', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-owner' } }, error: null });

      const updateSpy = vi.fn();
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1', is_owner: true, status: 'active' },
                      error: null,
                    }),
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
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'test' }, error: null }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      // Simulate missing RPC or database error
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'function update_business_configuration does not exist' },
      });

      const result = await updateBusinessConfigurationAction({
        organizationId: validOrgId,
        name: 'Updated Business',
        currency: 'USD',
        timezone: 'UTC',
      });

      // Must fail clearly
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/function update_business_configuration does not exist/);
      // Direct table write must NEVER be attempted (zero audit bypass)
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('executes updateBranchConfigurationAction successfully targeting the specified branch ID', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-owner' } }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1', is_owner: true, status: 'active' },
                      error: null,
                    }),
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
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'test' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await updateBranchConfigurationAction({
        organizationId: validOrgId,
        branchId: validBranchId,
        name: 'Colombo Flagship HQ',
        code: 'HQ-01',
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toMatch(/Branch information successfully updated/);
      expect(mockRpc).toHaveBeenCalledWith(
        'update_branch_configuration',
        expect.objectContaining({
          p_organization_id: validOrgId,
          p_branch_id: validBranchId,
          p_name: 'Colombo Flagship HQ',
          p_code: 'HQ-01',
        })
      );
    });

    it('branch action fails clearly and NEVER attempts direct table fallback when RPC errors', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-owner' } }, error: null });

      const updateSpy = vi.fn();
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1', is_owner: true, status: 'active' },
                      error: null,
                    }),
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
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'test' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            update: updateSpy,
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC execution failed: branch does not belong to organization' },
      });

      const result = await updateBranchConfigurationAction({
        organizationId: validOrgId,
        branchId: validBranchId,
        name: 'Colombo Flagship HQ',
        code: 'HQ-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/branch does not belong to organization/);
      // Zero un-audited direct branch updates
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
