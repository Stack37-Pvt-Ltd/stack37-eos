import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('TASK-UK-SUPER-005A customer migration', () => {
  let db: PGlite | undefined;
  afterEach(async () => { await db?.close(); db = undefined; });

  it('applies the migration and keeps customer updates and receipt links tenant-scoped and atomic', async () => {
    db = new PGlite();
    await db.waitReady;
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE SCHEMA private;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE TABLE public.organizations (id uuid PRIMARY KEY);
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TABLE public.permissions (id text PRIMARY KEY, module_name text NOT NULL, action text NOT NULL);
      CREATE TABLE public.roles (organization_id uuid NOT NULL, id uuid NOT NULL, name text NOT NULL, is_system boolean NOT NULL, PRIMARY KEY (organization_id, id));
      CREATE TABLE public.role_permissions (organization_id uuid NOT NULL, role_id uuid NOT NULL, permission_id text NOT NULL REFERENCES public.permissions(id), PRIMARY KEY (organization_id, role_id, permission_id));
      CREATE TABLE public.organization_members (organization_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL, is_owner boolean NOT NULL);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION private.has_permission(p_org_id uuid, p_action text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() IS NOT NULL $$;
      CREATE TABLE public.audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, action text, resource text, payload jsonb);
      CREATE FUNCTION private.insert_audit_log(p_org_id uuid, p_action text, p_resource text, p_payload jsonb DEFAULT NULL)
        RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v_id uuid; BEGIN INSERT INTO public.audit_logs(organization_id, action, resource, payload) VALUES (p_org_id, p_action, p_resource, p_payload) RETURNING id INTO v_id; RETURN v_id; END $$;
      CREATE TABLE public.retail_sales (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, branch_id uuid NOT NULL,
        receipt_number text NOT NULL, idempotency_key uuid NOT NULL, request_signature text NOT NULL,
        payment_method text NOT NULL, subtotal numeric NOT NULL, tax_total numeric NOT NULL, total numeric NOT NULL,
        cashier_user_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (organization_id, id), UNIQUE (organization_id, idempotency_key)
      );
      CREATE FUNCTION public.record_retail_sale(p_organization_id uuid, p_branch_id uuid, p_idempotency_key uuid, p_payment_method text, p_lines jsonb)
        RETURNS jsonb LANGUAGE plpgsql AS $$
        DECLARE v_id uuid; v_replayed boolean := false;
        BEGIN
          SELECT id INTO v_id FROM public.retail_sales WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key;
          IF FOUND THEN v_replayed := true;
          ELSE
            INSERT INTO public.retail_sales(organization_id, branch_id, receipt_number, idempotency_key, request_signature, payment_method, subtotal, tax_total, total)
            VALUES (p_organization_id, p_branch_id, 'TEST-1', p_idempotency_key, 'signature', p_payment_method, 1, 0, 1)
            RETURNING id INTO v_id;
          END IF;
          RETURN jsonb_build_object('saleId', v_id, 'receiptNumber', 'TEST-1', 'total', 1, 'replayed', v_replayed);
        END $$;
    `);
    const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261116100244_task_uk_super_005a_customer_directory.sql'), 'utf8');
    await db.exec(migration);

    const orgA = '10000000-0000-4000-8000-000000000001';
    const orgB = '10000000-0000-4000-8000-000000000002';
    const branch = '20000000-0000-4000-8000-000000000002';
    const user = '30000000-0000-4000-8000-000000000003';
    const key = '40000000-0000-4000-8000-000000000004';
    await db.exec(`INSERT INTO public.organizations(id) VALUES ('${orgA}'), ('${orgB}'); INSERT INTO auth.users(id) VALUES ('${user}'); SELECT set_config('request.jwt.claim.sub', '${user}', false);`);

    const customerResult = await db.query<{ customer: { id: string; name: string } }>(
      `SELECT public.upsert_retail_customer('${orgA}', NULL, 'Alice') AS customer`,
    );
    const customerId = customerResult.rows[0].customer.id;
    const saleResult = await db.query<{ sale: { saleId: string; customerId: string; replayed: boolean } }>(
      `SELECT public.record_retail_sale_with_customer('${orgA}', '${branch}', '${key}', 'cash', '[]'::jsonb, '${customerId}') AS sale`,
    );
    expect(saleResult.rows[0].sale.customerId).toBe(customerId);
    expect(saleResult.rows[0].sale.replayed).toBe(false);

    const replay = await db.query<{ sale: { customerId: string; replayed: boolean } }>(
      `SELECT public.record_retail_sale_with_customer('${orgA}', '${branch}', '${key}', 'cash', '[]'::jsonb, '${customerId}') AS sale`,
    );
    expect(replay.rows[0].sale.customerId).toBe(customerId);
    expect(replay.rows[0].sale.replayed).toBe(true);

    const secondCustomer = await db.query<{ id: string }>(`SELECT (public.upsert_retail_customer('${orgB}', NULL, 'Bob')->>'id') AS id`);
    await expect(db.query(
      `SELECT public.record_retail_sale_with_customer('${orgA}', '${branch}', '${key}', 'cash', '[]'::jsonb, '${secondCustomer.rows[0].id}')`,
    )).rejects.toThrow('selected customer is unavailable');

    const policy = await db.query<{ policyname: string }>(`SELECT policyname FROM pg_policies WHERE tablename = 'customers'`);
    expect(policy.rows.map((row) => row.policyname)).toContain('Authorized members read tenant customers');
    const audit = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM public.audit_logs WHERE action = 'retail.sale_customer_linked'`);
    expect(audit.rows[0].count).toBe('1');
  }, 30000);
});
