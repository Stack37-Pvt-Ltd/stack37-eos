import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('TASK-UK-SUPER-005H: bulk_record_opening_stock SQL function', () => {
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
        slug TEXT UNIQUE NOT NULL
      );

      CREATE TABLE public.branches (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        name TEXT NOT NULL
      );

      CREATE TABLE public.organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        status TEXT NOT NULL,
        is_owner BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE public.membership_branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        membership_id UUID NOT NULL,
        branch_id UUID NOT NULL,
        UNIQUE (organization_id, membership_id, branch_id)
      );

      CREATE FUNCTION private.has_permission(p_org_id UUID, p_action TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = p_org_id AND om.user_id = auth.uid() AND (om.is_owner = true OR p_action = 'inventory_edit')
        );
      $$;

      CREATE FUNCTION private.has_branch_access(p_org_id UUID, p_branch_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = p_branch_id AND b.organization_id = p_org_id
        );
      $$;

      CREATE TABLE public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        action TEXT,
        resource TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE FUNCTION private.insert_audit_log(p_org_id UUID, p_action TEXT, p_resource TEXT, p_payload JSONB DEFAULT NULL)
      RETURNS UUID LANGUAGE plpgsql AS $$
      DECLARE v_id UUID;
      BEGIN
        INSERT INTO public.audit_logs(organization_id, action, resource, payload)
        VALUES (p_org_id, p_action, p_resource, p_payload)
        RETURNING id INTO v_id;
        RETURN v_id;
      END $$;

      CREATE TABLE public.products (
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        id UUID NOT NULL,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        PRIMARY KEY (organization_id, id)
      );

      CREATE TABLE public.inventory_balances (
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        branch_id UUID NOT NULL REFERENCES public.branches(id),
        product_id UUID NOT NULL,
        quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, branch_id, product_id)
      );

      CREATE TABLE public.stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        branch_id UUID NOT NULL,
        product_id UUID NOT NULL,
        sale_id UUID,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'adjustment')),
        quantity_delta NUMERIC(14, 3) NOT NULL CHECK (quantity_delta <> 0),
        reason TEXT NOT NULL,
        actor_user_id UUID NOT NULL REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  };

  it('upserts inventory balances and records adjustment stock movements atomically', async () => {
    db = new PGlite();
    await db.waitReady;
    await setupBaseSchema(db);

    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261128000001_task_uk_super_005h_opening_stock.sql'),
      'utf8'
    );
    await db.exec(migration);

    const orgId = '11111111-1111-4000-a000-000000000001';
    const branchId = '22222222-2222-4000-a000-000000000001';
    const ownerUserId = '33333333-3333-4000-a000-000000000001';
    const prod1Id = '44444444-4444-4000-a000-000000000001';
    const prod2Id = '44444444-4444-4000-a000-000000000002';

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${ownerUserId}', 'owner@uksuper.com');
      INSERT INTO public.organizations (id, name, slug) VALUES ('${orgId}', 'UK Super', 'uk-super');
      INSERT INTO public.branches (id, organization_id, name) VALUES ('${branchId}', '${orgId}', 'Headquarters');
      INSERT INTO public.organization_members (organization_id, user_id, status, is_owner)
      VALUES ('${orgId}', '${ownerUserId}', 'active', true);
      INSERT INTO public.products (organization_id, id, name, sku, is_active)
      VALUES
        ('${orgId}', '${prod1Id}', 'Red Cow Milk 400g', 'UKS-0001', true),
        ('${orgId}', '${prod2Id}', 'Munchee Super Cream Cracker', 'UKS-0002', true);
    `);

    // Set auth context
    await db.exec(`SET request.jwt.claim.sub = '${ownerUserId}';`);

    const items = JSON.stringify([
      { product_id: prod1Id, quantity: 50 },
      { product_id: prod2Id, quantity: 120 },
    ]);

    const result = await db.query<{ bulk_record_opening_stock: { success: boolean; updated_count: number } }>(
      `SELECT public.bulk_record_opening_stock('${orgId}'::uuid, '${branchId}'::uuid, $1::jsonb);`,
      [items]
    );

    expect(result.rows[0].bulk_record_opening_stock.success).toBe(true);
    expect(result.rows[0].bulk_record_opening_stock.updated_count).toBe(2);

    // Verify inventory balances
    const balances = await db.query<{ product_id: string; quantity: string }>(
      `SELECT product_id, quantity FROM public.inventory_balances WHERE organization_id = '${orgId}' ORDER BY product_id;`
    );
    expect(balances.rows).toHaveLength(2);
    expect(Number(balances.rows[0].quantity)).toBe(50);
    expect(Number(balances.rows[1].quantity)).toBe(120);

    // Verify stock movements
    const movements = await db.query<{ movement_type: string; quantity_delta: string; reason: string }>(
      `SELECT movement_type, quantity_delta, reason FROM public.stock_movements WHERE organization_id = '${orgId}' ORDER BY product_id;`
    );
    expect(movements.rows).toHaveLength(2);
    expect(movements.rows[0].movement_type).toBe('adjustment');
    expect(movements.rows[0].reason).toBe('opening_stocktake');
    expect(Number(movements.rows[0].quantity_delta)).toBe(50);
    expect(Number(movements.rows[1].quantity_delta)).toBe(120);

    // Verify audit log
    const auditLogs = await db.query<{ action: string; payload: { item_count: number } }>(
      `SELECT action, payload FROM public.audit_logs WHERE organization_id = '${orgId}';`
    );
    expect(auditLogs.rows).toHaveLength(1);
    expect(auditLogs.rows[0].action).toBe('inventory.bulk_opening_stock_recorded');
    expect(auditLogs.rows[0].payload.item_count).toBe(2);
  }, 25000);

  it('rejects cross-tenant stocktake attempts', async () => {
    db = new PGlite();
    await db.waitReady;
    await setupBaseSchema(db);

    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261128000001_task_uk_super_005h_opening_stock.sql'),
      'utf8'
    );
    await db.exec(migration);

    const org1 = '11111111-1111-4000-a000-000000000001';
    const org2 = '11111111-1111-4000-a000-000000000002';
    const branch1 = '22222222-2222-4000-a000-000000000001';
    const branch2 = '22222222-2222-4000-a000-000000000002';
    const user1 = '33333333-3333-4000-a000-000000000001';
    const prodOrg2 = '44444444-4444-4000-a000-000000000002';

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${user1}', 'user1@acme.com');
      INSERT INTO public.organizations (id, name, slug) VALUES
        ('${org1}', 'Org 1', 'org-1'),
        ('${org2}', 'Org 2', 'org-2');
      INSERT INTO public.branches (id, organization_id, name) VALUES
        ('${branch1}', '${org1}', 'Branch 1'),
        ('${branch2}', '${org2}', 'Branch 2');
      INSERT INTO public.organization_members (organization_id, user_id, status, is_owner)
      VALUES ('${org1}', '${user1}', 'active', true);
      INSERT INTO public.products (organization_id, id, name, sku, is_active)
      VALUES ('${org2}', '${prodOrg2}', 'Alien Product', 'ALN-001', true);
    `);

    await db.exec(`SET request.jwt.claim.sub = '${user1}';`);

    // Attempting to set stock on Org 1 for a product belonging to Org 2
    const items = JSON.stringify([{ product_id: prodOrg2, quantity: 10 }]);

    await expect(
      db.query(`SELECT public.bulk_record_opening_stock('${org1}'::uuid, '${branch1}'::uuid, $1::jsonb);`, [items])
    ).rejects.toThrow(/does not exist or is not active in this organization/i);

    // Attempting to target branch from Org 2 while acting on Org 1
    await expect(
      db.query(`SELECT public.bulk_record_opening_stock('${org1}'::uuid, '${branch2}'::uuid, $1::jsonb);`, [items])
    ).rejects.toThrow(/does not belong to this organization/i);
  }, 25000);
});
