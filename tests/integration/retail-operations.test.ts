import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ids = {
  org: '10000000-0000-4000-8000-000000000001',
  branch: '20000000-0000-4000-8000-000000000002',
  product: '30000000-0000-4000-8000-000000000003',
  owner: '40000000-0000-4000-8000-000000000004',
  member: '50000000-0000-4000-8000-000000000005',
  employee: 'b0000000-0000-4000-8000-00000000000b',
  employeeUser: 'c0000000-0000-4000-8000-00000000000c',
  invitee: 'd0000000-0000-4000-8000-00000000000d',
  adminRole: '60000000-0000-4000-8000-000000000006',
};

describe('TASK-UK-SUPER-004 isolated retail migration behavior', () => {
  let db: PGlite | null = null;
  afterEach(async () => { await db?.close(); db = null; });

  it('applies Migrations 15/16 and verifies invitation, staff, retail and stock operations in isolation', async () => {
    db = new PGlite();
    await db.waitReady;
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, email_confirmed_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT NULLIF(current_setting('test.user', true), '')::UUID $$;
      CREATE TABLE public.organizations (id UUID PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'GBP');
      CREATE TABLE public.branches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES public.organizations(id), name TEXT NOT NULL, UNIQUE (organization_id, id), UNIQUE (organization_id, name));
      CREATE TABLE public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id), email TEXT, full_name TEXT);
      CREATE TABLE public.organization_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES public.organizations(id), user_id UUID NOT NULL REFERENCES auth.users(id), status TEXT NOT NULL, is_owner BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (organization_id, id), UNIQUE (organization_id, user_id));
      CREATE TABLE public.membership_branches (organization_id UUID NOT NULL, membership_id UUID NOT NULL, branch_id UUID NOT NULL, PRIMARY KEY (organization_id, membership_id, branch_id), FOREIGN KEY (organization_id, membership_id) REFERENCES public.organization_members(organization_id, id), FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id));
      CREATE TABLE public.roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES public.organizations(id), name TEXT NOT NULL, is_system BOOLEAN NOT NULL DEFAULT false, UNIQUE (organization_id, id), UNIQUE (organization_id, name));
      CREATE TABLE public.permissions (id TEXT PRIMARY KEY, module_name TEXT NOT NULL, action TEXT NOT NULL);
      CREATE TABLE public.role_permissions (organization_id UUID NOT NULL, role_id UUID NOT NULL, permission_id TEXT NOT NULL REFERENCES public.permissions(id), PRIMARY KEY (organization_id, role_id, permission_id), FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id));
      CREATE TABLE public.membership_roles (organization_id UUID NOT NULL, membership_id UUID NOT NULL, role_id UUID NOT NULL, PRIMARY KEY (organization_id, membership_id, role_id), FOREIGN KEY (organization_id, membership_id) REFERENCES public.organization_members(organization_id, id), FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id));
      CREATE TABLE public.invitations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES public.organizations(id), email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, role_id UUID, branch_id UUID, status TEXT NOT NULL DEFAULT 'pending', expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, UNIQUE (organization_id, id), FOREIGN KEY (organization_id, role_id) REFERENCES public.roles(organization_id, id), FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id));
      CREATE TABLE public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES public.organizations(id), name TEXT NOT NULL, sku TEXT NOT NULL, barcode TEXT, selling_price NUMERIC(12,2) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, UNIQUE (organization_id, sku));
      CREATE TABLE public.product_drafts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, status TEXT NOT NULL);
      CREATE TABLE public.audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, actor_id UUID, action TEXT NOT NULL, resource TEXT NOT NULL, payload JSONB);
      CREATE FUNCTION private.has_permission(UUID, TEXT) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$ SELECT true $$;
      CREATE FUNCTION private.can_assign_role(UUID, UUID) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$ SELECT true $$;
      CREATE FUNCTION private.insert_audit_log(UUID, TEXT, TEXT, JSONB DEFAULT NULL) RETURNS UUID LANGUAGE SQL AS $$ INSERT INTO public.audit_logs (organization_id, actor_id, action, resource, payload) VALUES ($1, auth.uid(), $2, $3, $4) RETURNING id $$;
      INSERT INTO public.permissions (id, module_name, action) VALUES ('manage_team', 'core', 'manage_team'), ('audit:read', 'core', 'audit:read');
      INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('${ids.owner}', 'owner@uk-super.test', now()), ('${ids.employeeUser}', 'staff@uk-super.test', now()), ('${ids.invitee}', 'new-staff@uk-super.test', now());
      INSERT INTO public.profiles (id, email, full_name) VALUES ('${ids.owner}', 'owner@uk-super.test', 'Owner'), ('${ids.employeeUser}', 'staff@uk-super.test', 'Staff'), ('${ids.invitee}', 'new-staff@uk-super.test', NULL);
      INSERT INTO public.organizations (id, name, slug, currency) VALUES ('${ids.org}', 'UK Super', 'uk-super', 'GBP');
      INSERT INTO public.branches (id, organization_id, name) VALUES ('${ids.branch}', '${ids.org}', 'Main store');
      INSERT INTO public.products (id, organization_id, name, sku, selling_price) VALUES ('${ids.product}', '${ids.org}', 'Milk', 'MILK-1', 1.25);
      INSERT INTO public.organization_members (id, organization_id, user_id, status, is_owner) VALUES ('${ids.member}', '${ids.org}', '${ids.owner}', 'active', true), ('${ids.employee}', '${ids.org}', '${ids.employeeUser}', 'active', false);
      INSERT INTO public.membership_branches (organization_id, membership_id, branch_id) VALUES ('${ids.org}', '${ids.member}', '${ids.branch}'), ('${ids.org}', '${ids.employee}', '${ids.branch}');
      INSERT INTO public.roles (id, organization_id, name, is_system) VALUES ('${ids.adminRole}', '${ids.org}', 'Administrator', true);
    `);

    await db.exec(`SELECT set_config('test.user', '${ids.owner}', false)`);
    const teamMigration = await readFile(path.resolve(process.cwd(), 'supabase/migrations/20261105000015_15_team_invitations_and_rpcs.sql'), 'utf8');
    const retailMigration = await readFile(path.resolve(process.cwd(), 'supabase/migrations/20261115000016_16_retail_sales_inventory.sql'), 'utf8');
    await db.exec(teamMigration);
    await db.exec(retailMigration);
    await db.exec(`
      INSERT INTO public.membership_roles (organization_id, membership_id, role_id) SELECT '${ids.org}', '${ids.member}', id FROM public.roles WHERE organization_id = '${ids.org}' AND name = 'Cashier';
      SELECT public.adjust_inventory('${ids.org}', '${ids.branch}', '${ids.product}', 10, 'Opening stock count');
    `);

    const inviteTokenHash = 'e'.repeat(64);
    const invitationId = await db.query(`SELECT public.create_invitation('${ids.org}', 'new-staff@uk-super.test', '${inviteTokenHash}', (SELECT id FROM public.roles WHERE organization_id = '${ids.org}' AND name = 'Cashier'), '${ids.branch}', now() + interval '7 days') AS id`) as { rows: Array<{ id: string }> };
    const invitation = await db.query(`SELECT public.get_invitation_details('${inviteTokenHash}') AS result`) as { rows: Array<{ result: { organization_slug: string; role_name: string } }> };
    const invitationCreatedAt = await db.query(`SELECT created_at FROM public.invitations WHERE id = '${invitationId.rows[0].id}'`) as { rows: Array<{ created_at: string }> };
    expect(invitation.rows[0].result).toMatchObject({ organization_slug: 'uk-super', role_name: 'Cashier' });
    expect(invitationCreatedAt.rows[0].created_at).toBeTruthy();
    await db.exec(`SELECT set_config('test.user', '${ids.invitee}', false)`);
    const acceptedInvite = await db.query(`SELECT public.accept_invitation('${inviteTokenHash}', '${ids.invitee}', 'New Staff') AS result`) as { rows: Array<{ result: { success: boolean; organization_slug: string } }> };
    expect(acceptedInvite.rows[0].result).toMatchObject({ success: true, organization_slug: 'uk-super' });
    await db.exec(`SELECT set_config('test.user', '${ids.owner}', false)`);

    const checkoutKey = '80000000-0000-4000-8000-000000000008';
    const basket = JSON.stringify([{ product_id: ids.product, quantity: 1.5 }]);
    const sale = await db.query(`SELECT public.record_retail_sale('${ids.org}', '${ids.branch}', '${checkoutKey}', 'cash', '${basket}'::JSONB) AS result`) as { rows: Array<{ result: { receiptNumber: string; total: number; replayed: boolean } }> };
    expect(sale.rows[0].result.receiptNumber).toMatch(/^UKS-\d{8}-\d{7}$/);
    expect(sale.rows[0].result.total).toBe(1.88);
    expect(sale.rows[0].result.replayed).toBe(false);

    const replay = await db.query(`SELECT public.record_retail_sale('${ids.org}', '${ids.branch}', '${checkoutKey}', 'cash', '${basket}'::JSONB) AS result`) as { rows: Array<{ result: { replayed: boolean } }> };
    expect(replay.rows[0].result.replayed).toBe(true);
    await expect(db.query(`SELECT public.record_retail_sale('${ids.org}', '${ids.branch}', '${checkoutKey}', 'cash', '[{"product_id":"${ids.product}","quantity":2}]'::JSONB)`)).rejects.toThrow(/different sale/);
    await expect(db.query(`SELECT public.record_retail_sale('${ids.org}', '${ids.branch}', '90000000-0000-4000-8000-000000000009', 'cash', '[{"product_id":"${ids.product}","quantity":100}]'::JSONB)`)).rejects.toThrow(/Insufficient stock/);

    const state = await db.query(`SELECT b.quantity, (SELECT count(*) FROM public.retail_sales) AS sales, (SELECT count(*) FROM public.stock_movements WHERE movement_type = 'sale') AS sale_movements FROM public.inventory_balances b WHERE b.organization_id = '${ids.org}' AND b.branch_id = '${ids.branch}' AND b.product_id = '${ids.product}'`) as { rows: Array<{ quantity: string; sales: number; sale_movements: number }> };
    expect(state.rows[0]).toEqual({ quantity: '8.500', sales: 1, sale_movements: 1 });
    const dashboard = await db.query(`SELECT public.get_retail_dashboard('${ids.org}', '${ids.branch}') AS result`) as { rows: Array<{ result: { grossSalesToday: number; salesToday: number } }> };
    expect(dashboard.rows[0].result.grossSalesToday).toBe(1.88);
    expect(dashboard.rows[0].result.salesToday).toBe(1);

    const assignment = await db.query(`SELECT public.update_staff_assignment('${ids.org}', '${ids.employee}', '${ids.adminRole}', '${ids.branch}') AS result`) as { rows: Array<{ result: { success: boolean } }> };
    expect(assignment.rows[0].result.success).toBe(true);
    const assignedRole = await db.query(`SELECT role_id FROM public.membership_roles WHERE organization_id = '${ids.org}' AND membership_id = '${ids.employee}'`) as { rows: Array<{ role_id: string }> };
    const assignedBranch = await db.query(`SELECT branch_id FROM public.membership_branches WHERE organization_id = '${ids.org}' AND membership_id = '${ids.employee}'`) as { rows: Array<{ branch_id: string }> };
    expect(assignedRole.rows[0].role_id).toBe(ids.adminRole);
    expect(assignedBranch.rows[0].branch_id).toBe(ids.branch);
    const audit = await db.query(`SELECT count(*) AS count FROM public.audit_logs WHERE organization_id = '${ids.org}' AND action IN ('team.member_invited', 'team.invitation_accepted', 'retail.sale_completed', 'inventory.stock_adjusted', 'team.assignment_updated')`) as { rows: Array<{ count: number }> };
    expect(audit.rows[0].count).toBe(5);

    const newOrg = 'a0000000-0000-4000-8000-00000000000a';
    await db.exec(`INSERT INTO public.organizations (id, name, slug, currency) VALUES ('${newOrg}', 'New Store', 'new-store', 'GBP')`);
    const cashierSeed = await db.query(`SELECT r.name, array_agg(rp.permission_id ORDER BY rp.permission_id) AS permissions FROM public.roles r JOIN public.role_permissions rp ON rp.organization_id = r.organization_id AND rp.role_id = r.id WHERE r.organization_id = '${newOrg}' AND r.name = 'Cashier' GROUP BY r.name`) as { rows: Array<{ name: string; permissions: string[] }> };
    expect(cashierSeed.rows[0].permissions).toEqual(['pos_checkout']);
    const newMember = 'a3000000-0000-4000-8000-00000000000a';
    await db.exec(`INSERT INTO public.organization_members (id, organization_id, user_id, status, is_owner) VALUES ('${newMember}', '${newOrg}', '${ids.owner}', 'active', true)`);
    await db.query(`SELECT private.provision_workspace_defaults('${newOrg}')`);
    const adminSeed = await db.query(`SELECT array_agg(rp.permission_id ORDER BY rp.permission_id) AS permissions FROM public.roles r JOIN public.role_permissions rp ON rp.organization_id = r.organization_id AND rp.role_id = r.id WHERE r.organization_id = '${newOrg}' AND r.name = 'Administrator'`) as { rows: Array<{ permissions: string[] }> };
    expect(adminSeed.rows[0].permissions).toEqual(['audit:read', 'inventory_edit', 'manage_invitations', 'manage_team', 'pos_checkout']);

    const customerMigration = await readFile(path.resolve(process.cwd(), 'supabase/migrations/20261116100244_task_uk_super_005a_customer_directory.sql'), 'utf8');
    const checkoutMigration = await readFile(path.resolve(process.cwd(), 'supabase/migrations/20261116111825_task_uk_super_005b_pos_checkout.sql'), 'utf8');
    await db.exec(customerMigration);
    await db.exec(checkoutMigration);
    await expect(db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', 'a4000000-0000-4000-8000-00000000000a', 0, NULL, NULL, '[{"method":"uber","amount":1.25}]'::jsonb, '[{"product_id":"${ids.product}","quantity":1}]'::jsonb)`)).rejects.toThrow(/Set the Uber commission/);
    await db.query(`SELECT public.update_retail_commission_rates('${ids.org}', 10, 12.5)`);
    await db.exec(`SELECT set_config('test.user', '${ids.employeeUser}', false)`);
    await expect(db.query(`SELECT public.update_retail_commission_rates('${ids.org}', 9, 9)`)).rejects.toThrow(/Primary Owner/);
    await db.exec(`SELECT set_config('test.user', '${ids.owner}', false)`);
    const completeKey = 'b1000000-0000-4000-8000-00000000000b';
    const completeLines = JSON.stringify([{ product_id: ids.product, quantity: 2 }]);
    const splitTenders = JSON.stringify([{ method: 'card', amount: 1 }, { method: 'uber', amount: 1.25 }]);
    const completed = await db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', '${completeKey}', 10, 'Checkout Customer', '+94 77 123 4567', '${splitTenders}'::jsonb, '${completeLines}'::jsonb) AS result`) as { rows: Array<{ result: { receiptNumber: string; subtotal: number; discountAmount: number; total: number; paymentMethod: string; tenders: Array<{ method: string; amount: number }>; customer: { phone: string }; lines: Array<{ quantity: number }> } }> };
    expect(completed.rows[0].result).toMatchObject({
      subtotal: 2.5, discountAmount: 0.25, total: 2.25, paymentMethod: 'mixed',
      customer: { phone: '+94771234567' },
      tenders: [{ method: 'card', amount: 1 }, { method: 'uber', amount: 1.25 }],
      providerSettlements: [{ provider: 'uber', commissionRate: 10, grossAmount: 1.25, commissionAmount: 0.13, netSettlement: 1.12 }],
      lines: [{ quantity: 2 }],
    });
    expect(completed.rows[0].result.receiptNumber).toMatch(/^UKS-\d{8}-\d{7}$/);

    const replayedCheckout = await db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', '${completeKey}', 10, 'Checkout Customer', '+94771234567', '${splitTenders}'::jsonb, '${completeLines}'::jsonb) AS result`) as { rows: Array<{ result: { replayed: boolean } }> };
    expect(replayedCheckout.rows[0].result.replayed).toBe(true);
    await expect(db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', '${completeKey}', 10, 'Different Customer', '+94771234567', '${splitTenders}'::jsonb, '${completeLines}'::jsonb)`)).rejects.toThrow(/different sale/);
    await expect(db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', 'c1000000-0000-4000-8000-00000000000c', 20.01, 'Checkout Customer', '+94771234567', '${splitTenders}'::jsonb, '${completeLines}'::jsonb)`)).rejects.toThrow(/between 0 and 20/);
    await expect(db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', 'd1000000-0000-4000-8000-00000000000d', 0, 'Checkout Customer', '+94771234567', '[{"method":"cash","amount":5}]'::jsonb, '${completeLines}'::jsonb)`)).rejects.toThrow(/exactly match/);
    const guestCheckout = await db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', 'e1000000-0000-4000-8000-00000000000e', 0, NULL, NULL, '[{"method":"cash","amount":1.25}]'::jsonb, '[{"product_id":"${ids.product}","quantity":1}]'::jsonb) AS result`) as { rows: Array<{ result: { customer: unknown } }> };
    expect(guestCheckout.rows[0].result.customer).toBeNull();
    const pickmeCheckout = await db.query(`SELECT public.complete_retail_checkout('${ids.org}', '${ids.branch}', 'f1000000-0000-4000-8000-00000000000f', 0, NULL, NULL, '[{"method":"pickme","amount":1.25}]'::jsonb, '[{"product_id":"${ids.product}","quantity":1}]'::jsonb) AS result`) as { rows: Array<{ result: { providerSettlements: Array<{ provider: string; commissionRate: number; commissionAmount: number; netSettlement: number }> } }> };
    expect(pickmeCheckout.rows[0].result.providerSettlements).toEqual([{ provider: 'pickme', commissionRate: 12.5, grossAmount: 1.25, commissionAmount: 0.16, netSettlement: 1.09 }]);
    const finalStock = await db.query(`SELECT quantity FROM public.inventory_balances WHERE organization_id = '${ids.org}' AND branch_id = '${ids.branch}' AND product_id = '${ids.product}'`) as { rows: Array<{ quantity: string }> };
    expect(finalStock.rows[0].quantity).toBe('4.500');
  }, 30000);
});
