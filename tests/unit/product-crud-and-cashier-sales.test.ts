import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('Product CRUD and Cashier Sales Metrics (Migration 20261128000003)', () => {
  let db: PGlite | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  const setupBaseSchema = async (database: PGlite) => {
    await database.exec(`
      CREATE SCHEMA auth;
      CREATE SCHEMA private;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;

      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT
      );

      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE TABLE public.organizations (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        currency TEXT NOT NULL DEFAULT 'LKR'
      );

      CREATE TABLE public.branches (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        name TEXT NOT NULL
      );

      CREATE TABLE public.roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        name TEXT NOT NULL
      );

      CREATE TABLE public.role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        role_id UUID NOT NULL REFERENCES public.roles(id),
        permission_id TEXT NOT NULL
      );

      CREATE TABLE public.organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        status TEXT NOT NULL DEFAULT 'active',
        is_owner BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE public.membership_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        membership_id UUID NOT NULL,
        role_id UUID NOT NULL
      );

      CREATE TABLE public.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        barcode TEXT,
        category_name TEXT,
        cost_price NUMERIC NOT NULL DEFAULT 0,
        selling_price NUMERIC NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (organization_id, sku)
      );

      CREATE TABLE public.inventory_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        branch_id UUID NOT NULL REFERENCES public.branches(id),
        product_id UUID NOT NULL REFERENCES public.products(id),
        quantity NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (organization_id, branch_id, product_id)
      );

      CREATE TABLE public.stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        branch_id UUID NOT NULL,
        product_id UUID NOT NULL,
        movement_type TEXT NOT NULL,
        quantity_delta NUMERIC NOT NULL,
        balance_after NUMERIC NOT NULL,
        reason TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE public.retail_sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        branch_id UUID NOT NULL REFERENCES public.branches(id),
        cashier_user_id UUID NOT NULL REFERENCES auth.users(id),
        receipt_number TEXT NOT NULL,
        total NUMERIC NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  };

  it('creates custom product and assigns initial stock balance atomically', async () => {
    db = new PGlite();
    await db.waitReady;
    await setupBaseSchema(db);

    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261128000003_product_crud_and_cashier_sales.sql'),
      'utf8'
    );
    await db.exec(migration);

    const userId = '11111111-1111-4111-8111-111111111111';
    const orgId = '22222222-2222-4222-8222-222222222222';
    const branchId = '33333333-3333-4333-8333-333333333333';

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${userId}', 'owner@uksuper.lk');
      INSERT INTO public.organizations (id, name, slug) VALUES ('${orgId}', 'UK Super', 'uk-super');
      INSERT INTO public.branches (id, organization_id, name) VALUES ('${branchId}', '${orgId}', 'Headquarters');
      INSERT INTO public.organization_members (organization_id, user_id, status, is_owner)
      VALUES ('${orgId}', '${userId}', 'active', true);
    `);

    // Set JWT user claim
    await db.exec(`SET request.jwt.claim.sub = '${userId}';`);

    // 1. Create custom product
    const createRes = await db.query<{ create_custom_product: { id: string; name: string; sku: string; barcode: string; sellingPrice: number; quantity: number } }>(`
      SELECT public.create_custom_product(
        '${orgId}'::UUID,
        'Anchor Full Cream Milk 400g',
        1050.00,
        950.00,
        '4791234567890',
        'ANC-400',
        'Dairy & Eggs',
        '${branchId}'::UUID,
        50
      ) AS create_custom_product;
    `);

    const created = createRes.rows[0].create_custom_product;
    expect(created.name).toBe('Anchor Full Cream Milk 400g');
    expect(created.sku).toBe('ANC-400');
    expect(created.barcode).toBe('4791234567890');
    expect(created.sellingPrice).toBe(1050);
    expect(created.quantity).toBe(50);

    // Verify stock balance in table
    const balanceRes = await db.query<{ quantity: string }>(`
      SELECT quantity FROM public.inventory_balances WHERE product_id = '${created.id}' AND branch_id = '${branchId}';
    `);
    expect(Number(balanceRes.rows[0].quantity)).toBe(50);

    // 2. Update custom product
    const updateRes = await db.query<{ update_custom_product: { name: string; sellingPrice: number } }>(`
      SELECT public.update_custom_product(
        '${orgId}'::UUID,
        '${created.id}'::UUID,
        'Anchor Milk Powder 400g (Updated)',
        1100.00,
        980.00,
        '4791234567890',
        'ANC-400',
        'Dairy & Eggs'
      ) AS update_custom_product;
    `);

    const updated = updateRes.rows[0].update_custom_product;
    expect(updated.name).toBe('Anchor Milk Powder 400g (Updated)');
    expect(updated.sellingPrice).toBe(1100);

    // 3. Deactivate custom product
    const deactivateRes = await db.query<{ deactivate_custom_product: { success: boolean } }>(`
      SELECT public.deactivate_custom_product('${orgId}'::UUID, '${created.id}'::UUID) AS deactivate_custom_product;
    `);
    expect(deactivateRes.rows[0].deactivate_custom_product.success).toBe(true);

    const productCheck = await db.query<{ is_active: boolean }>(`
      SELECT is_active FROM public.products WHERE id = '${created.id}';
    `);
    expect(productCheck.rows[0].is_active).toBe(false);

    // 4. Test Cashier Sales Metrics
    await db.exec(`
      INSERT INTO public.retail_sales (organization_id, branch_id, cashier_user_id, receipt_number, total, created_at)
      VALUES ('${orgId}', '${branchId}', '${userId}', 'UKS-0001', 2500, now());
    `);

    const metricsRes = await db.query<{ get_cashier_sales_metrics: { salesToday: number; grossSalesToday: number; totalSalesCount: number } }>(`
      SELECT public.get_cashier_sales_metrics('${orgId}'::UUID, '${branchId}'::UUID) AS get_cashier_sales_metrics;
    `);

    const metrics = metricsRes.rows[0].get_cashier_sales_metrics;
    expect(metrics.salesToday).toBe(1);
    expect(metrics.grossSalesToday).toBe(2500);
    expect(metrics.totalSalesCount).toBe(1);
  });
});
