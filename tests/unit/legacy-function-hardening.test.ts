import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('Legacy function search_path hardening migration', () => {
  let db: PGlite | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('sets prosecdef = true and search_path = "" on legacy functions and executes cleanly', async () => {
    db = new PGlite();
    await db.waitReady;

    // 1. Setup base tables and legacy triggers
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;

      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id),
        email TEXT,
        full_name TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE public.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        provisioning_status TEXT NOT NULL DEFAULT 'completed'
      );

      CREATE TABLE public.organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        status TEXT NOT NULL DEFAULT 'active',
        is_owner BOOLEAN NOT NULL DEFAULT false
      );
    `);

    // 2. Apply hardening migration
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261128000002_harden_legacy_function_search_paths.sql'),
      'utf8'
    );
    await db.exec(migration);

    // 3. Inspect pg_proc for prosecdef and proconfig (search_path)
    const procCheck = await db.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc
      WHERE proname IN ('handle_new_user', 'check_organization_owner', 'check_org_provisioned_owner')
        AND pronamespace = 'public'::regnamespace
      ORDER BY proname;
    `);

    expect(procCheck.rows).toHaveLength(3);
    for (const row of procCheck.rows) {
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toBeDefined();
      expect(row.proconfig?.some((cfg) => cfg.startsWith('search_path='))).toBe(true);
    }

    // 4. Attach triggers and test execution
    await db.exec(`
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

      CREATE CONSTRAINT TRIGGER ensure_one_active_owner
        AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.check_organization_owner();

      CREATE CONSTRAINT TRIGGER ensure_org_has_owner
        AFTER INSERT OR UPDATE ON public.organizations
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.check_org_provisioned_owner();
    `);

    // 5. Test handle_new_user trigger execution with search_path = ''
    const userId = '11111111-1111-4000-a000-000000000001';
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${userId}', 'newuser@uksuper.com', '{"full_name": "Test User"}'::jsonb);
    `);

    const profile = await db.query<{ id: string; email: string; full_name: string }>(
      `SELECT id, email, full_name FROM public.profiles WHERE id = '${userId}';`
    );
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0].email).toBe('newuser@uksuper.com');
    expect(profile.rows[0].full_name).toBe('Test User');

    // 6. Test check_organization_owner constraint execution
    const orgId = '22222222-2222-4000-a000-000000000001';
    await db.exec(`
      INSERT INTO public.organizations (id, name, slug, provisioning_status)
      VALUES ('${orgId}', 'UK Super', 'uk-super', 'pending');

      INSERT INTO public.organization_members (organization_id, user_id, status, is_owner)
      VALUES ('${orgId}', '${userId}', 'active', true);

      UPDATE public.organizations SET provisioning_status = 'completed' WHERE id = '${orgId}';
    `);

    // Verify membership query succeeds
    const member = await db.query<{ id: string; is_owner: boolean }>(
      `SELECT id, is_owner FROM public.organization_members WHERE organization_id = '${orgId}';`
    );
    expect(member.rows).toHaveLength(1);
    expect(member.rows[0].is_owner).toBe(true);
  }, 25000);
});
