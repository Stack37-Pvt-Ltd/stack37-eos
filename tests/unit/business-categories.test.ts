import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { getBusinessConfiguration } from '../../src/lib/auth/business-config';
import { updateBusinessConfigurationSchema } from '../../src/lib/validations/organization';
import * as supabaseServerModule from '../../src/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Business Categories Provisioning & Read Path (TASK-UK-SUPER-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // Helper to build a chainable mock Supabase query
  function createChainableMock(resolvedData: unknown = null, resolvedError: unknown = null) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
    return chain;
  }

  // =========================================================================
  // 1. Isolated PostgreSQL Database Schema & Seeding (PGlite)
  // =========================================================================
  describe('Isolated PostgreSQL Schema Verification (PGlite)', () => {
    it('seeds all 8 approved business categories with valid database UUIDs idempotently', async () => {
      const db = new PGlite();
      await db.waitReady;

      // 1. Create Core Schema: public.business_categories & organizations (from Migration 02)
      // Note: gen_random_uuid() is built-in in PostgreSQL 13+ and PGlite
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.business_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
        );

        CREATE TABLE IF NOT EXISTS public.organizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(63) NOT NULL UNIQUE,
          category_id UUID REFERENCES public.business_categories(id),
          country_code VARCHAR(2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
        );
      `);

      // 2. Read and apply Migration 13
      const migration13Path = path.resolve(__dirname, '../../supabase/migrations/20261028000013_13_seed_business_categories.sql');
      const migration13Sql = fs.readFileSync(migration13Path, 'utf8');
      await db.exec(migration13Sql);

      // 3. Verify exactly 8 categories were inserted
      const countResult = (await db.query('SELECT COUNT(*) AS count FROM public.business_categories;')) as {
        rows: Array<{ count: string }>;
      };
      expect(Number(countResult.rows[0].count)).toBe(8);

      // 4. Verify all 8 categories have authentic database UUIDs
      const categoriesResult = (await db.query(
        'SELECT id, name, description FROM public.business_categories ORDER BY name;'
      )) as {
        rows: Array<{ id: string; name: string; description: string }>;
      };
      expect(categoriesResult.rows.length).toBe(8);
      for (const cat of categoriesResult.rows) {
        expect(UUID_PATTERN.test(cat.id)).toBe(true);
        expect(cat.id).not.toBe('cat-retail');
        expect(cat.id).not.toContain('cat-');
      }

      // 5. Verify 'Retail & E-Commerce' is present with valid UUID
      const retailCat = categoriesResult.rows.find((c: { name: string }) => c.name === 'Retail & E-Commerce');
      expect(retailCat).toBeDefined();
      expect(UUID_PATTERN.test(retailCat!.id)).toBe(true);
      expect(retailCat!.description).toBe('Consumer goods, storefronts, supermarkets, and online retail');

      // 6. Verify foreign key assignment to Test workspace in organizations table
      const testOrgId = '00000000-0000-4000-8000-000000000001';
      await db.exec(`
        INSERT INTO public.organizations (id, name, slug, category_id, country_code)
        VALUES ('${testOrgId}', 'Test', 'test', '${retailCat!.id}', 'GB');
      `);

      const orgCheck = (await db.query(
        `SELECT id, slug, category_id FROM public.organizations WHERE id = '${testOrgId}';`
      )) as {
        rows: Array<{ id: string; slug: string; category_id: string }>;
      };
      expect(orgCheck.rows[0].category_id).toBe(retailCat!.id);

      // 7. Verify Idempotency: Re-running Migration 13 does not alter UUIDs or duplicate rows
      const originalRetailId = retailCat!.id;
      await db.exec(migration13Sql);

      const recheckCount = (await db.query('SELECT COUNT(*) AS count FROM public.business_categories;')) as {
        rows: Array<{ count: string }>;
      };
      expect(Number(recheckCount.rows[0].count)).toBe(8);

      const recheckRetail = (await db.query(
        "SELECT id FROM public.business_categories WHERE name = 'Retail & E-Commerce';"
      )) as {
        rows: Array<{ id: string }>;
      };
      expect(recheckRetail.rows[0].id).toBe(originalRetailId);

      await db.close();
    }, 30000);
  });

  // =========================================================================
  // 2. Read Path & Error Reporting in getBusinessConfiguration
  // =========================================================================
  describe('getBusinessConfiguration Category Read Path & Error Reporting', () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const memberId = '22222222-2222-4222-8222-222222222222';
    const validRetailUuid = '99999999-9999-4999-8999-999999999999';

    it('returns authentic database categories with valid UUIDs to Business Settings', async () => {
      const mockOrg = {
        id: orgId,
        name: 'Test',
        slug: 'test',
        category_id: validRetailUuid,
        country_code: 'GB',
      };
      const mockMember = { id: memberId, organization_id: orgId, is_owner: true, status: 'active' };
      const mockDbCategories = [
        { id: validRetailUuid, name: 'Retail & E-Commerce', description: 'Consumer goods and supermarkets' },
        { id: '88888888-8888-4888-8888-888888888888', name: 'Software & Technology', description: 'SaaS and digital' },
      ];

      const branchesChain = createChainableMock(null, null);
      const membersChain = createChainableMock(mockMember, null);
      const orgChain = createChainableMock(mockOrg, null);

      const mockFrom = vi.fn((table: string) => {
        if (table === 'organizations') return orgChain;
        if (table === 'branches') return branchesChain;
        if (table === 'organization_members') return membersChain;
        if (table === 'membership_branches') return createChainableMock(null, null);
        if (table === 'business_categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockDbCategories, error: null }),
            }),
          };
        }
        return createChainableMock(null, null);
      });

      vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue({ from: mockFrom } as unknown as import('@supabase/supabase-js').SupabaseClient);

      const config = await getBusinessConfiguration(orgId, memberId);

      expect(config).not.toBeNull();
      expect(config?.categories.length).toBe(2);
      expect(config?.categories[0].id).toBe(validRetailUuid);
      expect(config?.categories[0].name).toBe('Retail & E-Commerce');
      expect(config?.organization.categoryId).toBe(validRetailUuid);
      expect(config?.organization.categoryName).toBe('Retail & E-Commerce');
      expect(config?.hasCategoriesError).toBe(false);

      // Verify that frontend validation UUID_PATTERN filter accepts all returned categories
      const validForFrontend = config!.categories.filter((c) => UUID_PATTERN.test(c.id));
      expect(validForFrontend.length).toBe(2);
    });

    it('reports database query failure safely without leaking database error details to client', async () => {
      const mockOrg = { id: orgId, name: 'Test', slug: 'test' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const branchesChain = createChainableMock(null, null);
      const orgChain = createChainableMock(mockOrg, null);

      const mockFrom = vi.fn((table: string) => {
        if (table === 'organizations') return orgChain;
        if (table === 'branches') return branchesChain;
        if (table === 'organization_members') return createChainableMock(null, null);
        if (table === 'membership_branches') return createChainableMock(null, null);
        if (table === 'business_categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'permission denied for table business_categories' },
              }),
            }),
          };
        }
        return createChainableMock(null, null);
      });

      vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue({ from: mockFrom } as unknown as import('@supabase/supabase-js').SupabaseClient);

      const config = await getBusinessConfiguration(orgId);

      expect(config).not.toBeNull();
      // Error flag is reported safely without leaking raw database details
      expect(config?.hasCategoriesError).toBe(true);
      // Raw database error string is strictly NOT exposed on client configuration data
      expect((config as unknown as Record<string, unknown>).categoriesError).toBeUndefined();
      // Categories array is empty — NO fallback to non-UUID placeholder IDs like cat-retail
      expect(config?.categories).toEqual([]);
      expect(config?.organization.categoryName).toBeNull();
      // Internal error details are logged server-side only
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[business-config] Failed to fetch business categories:',
        'permission denied for table business_categories'
      );
    });

    it('returns empty array when database table has zero rows without placeholder fallback', async () => {
      const mockOrg = { id: orgId, name: 'Test', slug: 'test' };
      const branchesChain = createChainableMock(null, null);
      const orgChain = createChainableMock(mockOrg, null);

      const mockFrom = vi.fn((table: string) => {
        if (table === 'organizations') return orgChain;
        if (table === 'branches') return branchesChain;
        if (table === 'organization_members') return createChainableMock(null, null);
        if (table === 'membership_branches') return createChainableMock(null, null);
        if (table === 'business_categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return createChainableMock(null, null);
      });

      vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue({ from: mockFrom } as unknown as import('@supabase/supabase-js').SupabaseClient);

      const config = await getBusinessConfiguration(orgId);

      expect(config).not.toBeNull();
      expect(config?.hasCategoriesError).toBe(false);
      // Strictly empty array — placeholder IDs like 'cat-retail' are eliminated
      expect(config?.categories).toEqual([]);
      expect(config?.categories.some((c) => c.id.startsWith('cat-'))).toBe(false);
    });
  });

  // =========================================================================
  // 3. Frontend Validation Contract Protection
  // =========================================================================
  describe('Frontend Validation Contract (Zod schema)', () => {
    const validOrgId = '11111111-1111-4111-8111-111111111111';
    const validCatUuid = '99999999-9999-4999-8999-999999999999';

    it('accepts valid database UUID for categoryId', () => {
      const result = updateBusinessConfigurationSchema.safeParse({
        organizationId: validOrgId,
        name: 'Test Supermarket',
        categoryId: validCatUuid,
        currency: 'GBP',
        timezone: 'Europe/London',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryId).toBe(validCatUuid);
      }
    });

    it('permits empty string or omitted categoryId', () => {
      const result = updateBusinessConfigurationSchema.safeParse({
        organizationId: validOrgId,
        name: 'Test Supermarket',
        categoryId: '',
        currency: 'GBP',
        timezone: 'Europe/London',
      });
      expect(result.success).toBe(true);
    });

    it('strictly rejects placeholder IDs such as cat-retail with validation error', () => {
      const result = updateBusinessConfigurationSchema.safeParse({
        organizationId: validOrgId,
        name: 'Test Supermarket',
        categoryId: 'cat-retail',
        currency: 'GBP',
        timezone: 'Europe/London',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const catError = result.error.issues.find((i) => i.path[0] === 'categoryId');
        expect(catError).toBeDefined();
        expect(catError?.message).toBe('Invalid business category selected.');
      }
    });
  });
});
