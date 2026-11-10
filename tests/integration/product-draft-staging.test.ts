import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Loopback Safety Guard (Codex Review Finding 5 - Fail closed on hosted URLs)
// ============================================================================
const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const parsedUrl = new URL(LOCAL_SUPABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error(
    `SAFETY ABORT: Integration tests are strictly prohibited against non-loopback URLs! Detected host: ${parsedUrl.hostname}. Local Supabase loopback (127.0.0.1 / localhost) required.`
  );
}

const LOCAL_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const DRAFT_PATH = path.resolve(
  __dirname,
  '../../.worktrees/inventory-drafts/TASK-UK-SUPER-002/uk-super-hosted-test-inventory-draft.json'
);

interface DraftSource {
  filename: string;
  sha256: string;
  row_count: number;
}

interface DraftItem {
  source_file: string;
  source_id: number;
  source_raw: Record<string, unknown>;
  suggested_product: {
    name: string;
    barcode: string | null;
    source_category: string | null;
    company_name: string | null;
    wholesale_price_lkr: number | null;
    retail_price_lkr: number | null;
    sku: string | null;
  };
  review_flags: string[];
}

interface DraftPayload {
  sources: DraftSource[];
  items: DraftItem[];
  summary: {
    total_source_files: number;
    total_source_rows: number;
    review_flag_counts: Record<string, number>;
  };
}

describe('TASK-UK-SUPER-002 — Product Draft Staging & Catalog Import Integration', () => {
  let adminClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let ownerClient: SupabaseClient;
  let memberClient: SupabaseClient;
  let outsiderClient: SupabaseClient;

  let disposableOrgId: string;
  let disposableOrgSlug: string;
  let draftData: DraftPayload;

  const OWNER_USER_ID = '0e7bba7b-13f3-4f06-9e35-07800d9965da'; // test@stack37.com
  const MEMBER_USER_ID = 'ecff6a40-6d1b-4f05-b07a-660abbedf701'; // unauthorized@stack37.com

  beforeAll(async () => {
    adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Create a dedicated disposable test organization (Codex Finding 5)
    disposableOrgId = crypto.randomUUID();
    disposableOrgSlug = `dispstage${Date.now().toString().slice(-8)}`;

    const { error: orgErr } = await adminClient.from('organizations').insert({
      id: disposableOrgId,
      name: 'Disposable Staging Test Org',
      slug: disposableOrgSlug,
      provisioning_status: 'pending',
    });
    if (orgErr) {
      throw new Error(`Failed to create disposable org: ${orgErr.message}`);
    }

    // 2. Add owner membership
    const { data: ownerMem, error: ownerMemErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: disposableOrgId,
        user_id: OWNER_USER_ID,
        is_owner: true,
        status: 'active',
      })
      .select('id')
      .single();
    if (ownerMemErr) {
      throw new Error(`Failed to create owner membership: ${ownerMemErr.message}`);
    }

    // Provision Administrator role for disposable org
    const { data: adminRole, error: roleErr } = await adminClient
      .from('roles')
      .insert({
        organization_id: disposableOrgId,
        name: 'Administrator',
        is_system: true,
      })
      .select('id')
      .single();
    if (roleErr) {
      throw new Error(`Failed to create admin role: ${roleErr.message}`);
    }

    // Map Administrator role to owner
    await adminClient.from('membership_roles').insert({
      organization_id: disposableOrgId,
      membership_id: ownerMem.id,
      role_id: adminRole.id,
    });

    // 3. Add non-admin member membership (unauthorized@stack37.com as 'Member' with no inventory_edit)
    const { data: memberMem, error: memberMemErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: disposableOrgId,
        user_id: MEMBER_USER_ID,
        is_owner: false,
        status: 'active',
      })
      .select('id')
      .single();
    if (memberMemErr) {
      throw new Error(`Failed to create member membership: ${memberMemErr.message}`);
    }

    const { data: stdMemberRole, error: stdRoleErr } = await adminClient
      .from('roles')
      .insert({
        organization_id: disposableOrgId,
        name: 'Member',
        is_system: false,
      })
      .select('id')
      .single();
    if (stdRoleErr) {
      throw new Error(`Failed to create member role: ${stdRoleErr.message}`);
    }

    await adminClient.from('membership_roles').insert({
      organization_id: disposableOrgId,
      membership_id: memberMem.id,
      role_id: stdMemberRole.id,
    });

    // 4. Mark organization completed to satisfy ownership trigger
    const { error: compErr } = await adminClient
      .from('organizations')
      .update({ provisioning_status: 'completed' })
      .eq('id', disposableOrgId);
    if (compErr) {
      throw new Error(`Failed to complete disposable org: ${compErr.message}`);
    }

    // 5. Authenticate clients
    // Owner client
    ownerClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInOwner } = await ownerClient.auth.signInWithPassword({
      email: 'test@stack37.com',
      password: 'TestPassword123!Secure',
    });
    if (signInOwner) {
      throw new Error(`Owner sign-in failed: ${signInOwner.message}`);
    }

    // Member client (Active member without owner or inventory_edit)
    memberClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInMember } = await memberClient.auth.signInWithPassword({
      email: 'unauthorized@stack37.com',
      password: 'TestPassword123!Secure',
    });
    if (signInMember) {
      throw new Error(`Member sign-in failed: ${signInMember.message}`);
    }

    // Outsider client (User who is NOT a member of disposableOrgId)
    outsiderClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInOutsider } = await outsiderClient.auth.signInWithPassword({
      email: 'suspended@stack37.com',
      password: 'TestPassword123!Secure',
    });
    if (signInOutsider) {
      throw new Error(`Outsider sign-in failed: ${signInOutsider.message}`);
    }

    // 6. Load local draft manifest
    expect(fs.existsSync(DRAFT_PATH)).toBe(true);
    draftData = JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf8'));
    expect(draftData.items.length).toBe(2079);
  });

  afterAll(async () => {
    // Clean up disposable organization (cascades to all memberships, drafts, products, roles)
    if (disposableOrgId && adminClient) {
      await adminClient.from('organizations').delete().eq('id', disposableOrgId);
    }
  });

  // =========================================================================
  // 1. P0 Security: Anonymous RPC Rejection (Codex Review Finding 1)
  // =========================================================================
  describe('P0 Security: Anonymous RPC Protection', () => {
    it('rejects unauthenticated/anon call to stage_product_drafts', async () => {
      const { data, error } = await anonClient.rpc('stage_product_drafts', {
        p_organization_id: disposableOrgId,
        p_items: [draftData.items[0]],
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      // Revoked execute privilege results in 401/403 or permission denied / unauthenticated error
      expect(error!.message).toMatch(/permission denied|Access denied|unauthenticated/i);
    });

    it('rejects unauthenticated/anon call to resolve_product_draft', async () => {
      const { data, error } = await anonClient.rpc('resolve_product_draft', {
        p_organization_id: disposableOrgId,
        p_draft_id: crypto.randomUUID(),
        p_updates: { status: 'resolved' },
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/permission denied|Access denied|unauthenticated/i);
    });

    it('rejects unauthenticated/anon call to publish_product_drafts', async () => {
      const { data, error } = await anonClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [crypto.randomUUID()],
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/permission denied|Access denied|unauthenticated/i);
    });

    it('rejects unauthenticated/anon call to get_product_draft_summary', async () => {
      const { data, error } = await anonClient.rpc('get_product_draft_summary', {
        p_organization_id: disposableOrgId,
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/permission denied|Access denied|unauthenticated/i);
    });
  });

  // =========================================================================
  // 2. P1 Security: Active Member Role Checks (Codex Review Finding 2)
  // =========================================================================
  describe('P1 Security: Role-Based Access Control', () => {
    it('rejects stage_product_drafts from active member lacking owner/inventory role', async () => {
      const { data, error } = await memberClient.rpc('stage_product_drafts', {
        p_organization_id: disposableOrgId,
        p_items: [draftData.items[0]],
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/Access denied: requires owner or administrator role/i);
    });

    it('rejects resolve_product_draft from active member lacking owner/inventory role', async () => {
      const { data, error } = await memberClient.rpc('resolve_product_draft', {
        p_organization_id: disposableOrgId,
        p_draft_id: crypto.randomUUID(),
        p_updates: { status: 'resolved' },
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/Access denied: requires owner or administrator role/i);
    });

    it('rejects publish_product_drafts from active member lacking owner/inventory role', async () => {
      const { data, error } = await memberClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [crypto.randomUUID()],
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/Access denied: requires owner or administrator role/i);
    });

    it('allows active member to view get_product_draft_summary (read summary policy)', async () => {
      const { data, error } = await memberClient.rpc('get_product_draft_summary', {
        p_organization_id: disposableOrgId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.organization_id).toBe(disposableOrgId);
      expect(data.total_staged).toBe(0);
    });

    it('rejects outsider from executing any RPC or reading drafts via RLS', async () => {
      const { error: rpcErr } = await outsiderClient.rpc('get_product_draft_summary', {
        p_organization_id: disposableOrgId,
      });
      expect(rpcErr).not.toBeNull();
      expect(rpcErr!.message).toMatch(/Access denied: not an active member/i);

      const { data: rlsData } = await outsiderClient
        .from('product_drafts')
        .select('*')
        .eq('organization_id', disposableOrgId);
      expect(rlsData?.length || 0).toBe(0);
    });
  });

  // =========================================================================
  // 3. Staging Ingestion & Exact 2,079-Row Reconciliation (Codex Finding 7)
  // =========================================================================
  describe('Staging Ingestion & Manifest Reconciliation', () => {
    it('stages all 2,079 source items via stage_product_drafts RPC in chunks', async () => {
      const CHUNK_SIZE = 500;
      const items = draftData.items;

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const { data, error } = await ownerClient.rpc('stage_product_drafts', {
          p_organization_id: disposableOrgId,
          p_items: chunk,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.success).toBe(true);
      }

      // Verify exact 2,079 rows staged
      const { count, error: countErr } = await adminClient
        .from('product_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', disposableOrgId);

      expect(countErr).toBeNull();
      expect(count).toBe(2079);
    });

    it('reconciles exact set of 2,079 (source_file, source_id) tuples and per-file counts', async () => {
      // PostgREST limits queries to 1000 rows by default; fetch in pages to reconcile all 2,079
      const allStaged: Array<{ source_file: string; source_id: number }> = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await adminClient
          .from('product_drafts')
          .select('source_file, source_id')
          .eq('organization_id', disposableOrgId)
          .range(from, to);

        expect(error).toBeNull();
        if (data && data.length > 0) {
          allStaged.push(...data);
          page++;
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      expect(allStaged.length).toBe(2079);

      // Verify min source ID = 6 and max source ID = 2211 (Codex Finding 7)
      const ids = allStaged.map((r) => r.source_id);
      const minId = Math.min(...ids);
      const maxId = Math.max(...ids);
      expect(minId).toBe(6);
      expect(maxId).toBe(2211);

      // Verify every (source_file, source_id) pair in staged database exists in source draft
      const sourceKeySet = new Set(
        draftData.items.map((item) => `${item.source_file}#${item.source_id}`)
      );
      expect(sourceKeySet.size).toBe(2079);

      for (const row of allStaged) {
        const key = `${row.source_file}#${row.source_id}`;
        expect(sourceKeySet.has(key)).toBe(true);
      }

      // Verify per-file row counts against source manifest
      const stagedCountsByFile: Record<string, number> = {};
      for (const row of allStaged) {
        stagedCountsByFile[row.source_file] = (stagedCountsByFile[row.source_file] || 0) + 1;
      }

      for (const src of draftData.sources) {
        expect(stagedCountsByFile[src.filename]).toBe(src.row_count);
      }
    });

    it('matches expected review flag distribution', async () => {
      const { data: summary, error } = await ownerClient.rpc('get_product_draft_summary', {
        p_organization_id: disposableOrgId,
      });

      expect(error).toBeNull();
      expect(summary.total_staged).toBe(2079);
      expect(summary.flagged_total).toBe(395);

      const byFlag = summary.by_flag;
      expect(byFlag['MISSING_BARCODE']).toBe(248);
      expect(byFlag['DUPLICATE_BARCODE']).toBe(84);
      expect(byFlag['INVALID_BARCODE']).toBe(36);
      expect(byFlag['RETAIL_BELOW_WHOLESALE']).toBe(15);
      expect(byFlag['SOURCE_QUANTITY_IGNORED']).toBe(11);
      expect(byFlag['CATEGORY_REVIEW']).toBe(9);
      expect(byFlag['SUGGESTED_NAME_BARCODE_SWAP']).toBe(1);
      expect(byFlag['NAME_REVIEW']).toBe(1);
    });
  });

  // =========================================================================
  // 4. P1 Preservation of Human Review Work on Re-staging (Codex Finding 4)
  // =========================================================================
  describe('P1 Review Preservation: Re-staging Protection', () => {
    it('preserves reviewed/resolved status and human notes during subsequent re-staging', async () => {
      // Find Item 17 (Loacker wafer with swap flag)
      const { data: item17 } = await adminClient
        .from('product_drafts')
        .select('id, name, barcode, review_flags, status')
        .eq('organization_id', disposableOrgId)
        .eq('source_id', 17)
        .single();

      expect(item17).toBeDefined();

      // Human resolves Item 17
      const { data: res, error: resErr } = await ownerClient.rpc('resolve_product_draft', {
        p_organization_id: disposableOrgId,
        p_draft_id: item17!.id,
        p_updates: {
          name: 'Loacker Napolitaner Hazelnut Wafer 45g (Verified)',
          status: 'resolved',
          resolution_notes: 'Confirmed swap by inventory team: name swapped with barcode',
        },
      });
      expect(resErr).toBeNull();
      expect(res.success).toBe(true);

      // Now re-run staging with the original source item for Item 17
      const originalItem17 = draftData.items.find((i) => i.source_id === 17);
      expect(originalItem17).toBeDefined();

      const { data: restageRes, error: restageErr } = await ownerClient.rpc('stage_product_drafts', {
        p_organization_id: disposableOrgId,
        p_items: [originalItem17],
      });
      expect(restageErr).toBeNull();
      expect(restageRes.success).toBe(true);

      // Inspect Item 17 in DB: status and human notes MUST be preserved!
      const { data: preservedItem } = await adminClient
        .from('product_drafts')
        .select('name, status, resolution_notes')
        .eq('id', item17!.id)
        .single();

      expect(preservedItem!.name).toBe('Loacker Napolitaner Hazelnut Wafer 45g (Verified)');
      expect(preservedItem!.status).toBe('resolved');
      expect(preservedItem!.resolution_notes).toBe(
        'Confirmed swap by inventory team: name swapped with barcode'
      );
    });
  });

  // =========================================================================
  // 5. P1 Publishing Anomaly Review & Price Bounds (Codex Finding 3)
  // =========================================================================
  describe('P1 Catalog Publishing: Validation & Batch Protection', () => {
    it('rejects publishing an unreviewed flagged draft with item-level error', async () => {
      // Item 248 has MISSING_BARCODE flag and is still 'staged'
      const { data: flaggedDraft } = await adminClient
        .from('product_drafts')
        .select('id, source_id, status, review_flags')
        .eq('organization_id', disposableOrgId)
        .eq('source_id', 248)
        .single();

      expect(flaggedDraft).toBeDefined();
      expect(flaggedDraft!.status).toBe('staged');
      expect(flaggedDraft!.review_flags.length).toBeGreaterThan(0);

      const { data: pubRes, error } = await ownerClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [flaggedDraft!.id],
      });

      expect(error).toBeNull();
      expect(pubRes.published_count).toBe(0);
      expect(pubRes.failed_count).toBe(1);
      expect(pubRes.errors.length).toBe(1);
      expect(pubRes.errors[0].source_id).toBe(248);
      expect(pubRes.errors[0].error).toMatch(/unresolved review flags/i);

      // Verify draft is NOT published
      const { data: draftCheck } = await adminClient
        .from('product_drafts')
        .select('status')
        .eq('id', flaggedDraft!.id)
        .single();
      expect(draftCheck!.status).toBe('staged');
    });

    it('rejects draft with price overflow (Source ID 114) without aborting the batch', async () => {
      // Find Source ID 114 (wholesale_price = 8,901,058,905,113.00, fits numeric(18,2) but overflows numeric(12,2))
      const { data: id114Draft } = await adminClient
        .from('product_drafts')
        .select('id, source_id, wholesale_price')
        .eq('organization_id', disposableOrgId)
        .eq('source_id', 114)
        .single();

      expect(id114Draft).toBeDefined();
      expect(Number(id114Draft!.wholesale_price)).toBeGreaterThanOrEqual(10000000000);

      // Human resolves ID 114 flags without fixing the overflow wholesale price
      const { data: res114, error: res114Err } = await ownerClient.rpc('resolve_product_draft', {
        p_organization_id: disposableOrgId,
        p_draft_id: id114Draft!.id,
        p_updates: {
          status: 'resolved',
          resolution_notes: 'Reviewed anomaly flags; testing catalog price bounds check',
        },
      });
      expect(res114Err).toBeNull();
      expect(res114.success).toBe(true);

      // Also pick a clean item: source_id 6 (Orion Choco Pie)
      const { data: cleanItem6 } = await adminClient
        .from('product_drafts')
        .select('id, source_id')
        .eq('organization_id', disposableOrgId)
        .eq('source_id', 6)
        .single();
      expect(cleanItem6).toBeDefined();

      // Publish both together in a single batch
      const { data: batchPubRes, error } = await ownerClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [id114Draft!.id, cleanItem6!.id],
        p_auto_generate_sku: true,
        p_sku_prefix: 'UKS-',
      });

      expect(error).toBeNull();
      expect(batchPubRes.success).toBe(true);
      // Clean item 6 must publish successfully, while ID 114 fails gracefully
      expect(batchPubRes.published_count).toBe(1);
      expect(batchPubRes.failed_count).toBe(1);
      expect(batchPubRes.errors.length).toBe(1);
      expect(batchPubRes.errors[0].source_id).toBe(114);
      expect(batchPubRes.errors[0].error).toMatch(/Wholesale price out of bounds/i);

      // Confirm clean item 6 is published in public.products
      const { data: prod6 } = await adminClient
        .from('products')
        .select('sku, name, cost_price, selling_price')
        .eq('organization_id', disposableOrgId)
        .eq('sku', 'UKS-00006')
        .single();

      expect(prod6).toBeDefined();
      expect(prod6!.name).toContain('ORION CHOCO PIE');
      expect(Number(prod6!.cost_price)).toBe(1200.0);
      expect(Number(prod6!.selling_price)).toBe(1680.0);
    });

    it('rejects publishing drafts with missing retail price', async () => {
      // Create a test draft with null retail price
      const { data: nullPriceDraft } = await adminClient
        .from('product_drafts')
        .insert({
          organization_id: disposableOrgId,
          source_file: 'test_null_price.json',
          source_id: 88881,
          source_raw: {},
          name: 'Item With Missing Price',
          retail_price: null,
          wholesale_price: 100,
          status: 'resolved', // Resolved status but missing price
        })
        .select('id')
        .single();

      const { data: pubRes, error } = await ownerClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [nullPriceDraft!.id],
      });

      expect(error).toBeNull();
      expect(pubRes.published_count).toBe(0);
      expect(pubRes.failed_count).toBe(1);
      expect(pubRes.errors[0].error).toMatch(/Retail selling price must be provided/i);
    });

    it('rejects publishing when barcode conflicts with an already published product', async () => {
      // Item 6 was published above with barcode '8936036025866'.
      const { data: conflictDraft } = await adminClient
        .from('product_drafts')
        .insert({
          organization_id: disposableOrgId,
          source_file: 'test_conflict.json',
          source_id: 88882,
          source_raw: { name: 'Conflicting Item' },
          name: 'Conflicting Item With Same Barcode',
          barcode: '8936036025866', // Same barcode as Item 6
          wholesale_price: 100,
          retail_price: 200,
          status: 'resolved',
        })
        .select('id')
        .single();

      const { data: pubRes, error } = await ownerClient.rpc('publish_product_drafts', {
        p_organization_id: disposableOrgId,
        p_draft_ids: [conflictDraft!.id],
        p_auto_generate_sku: true,
        p_sku_prefix: 'UKS-',
      });

      expect(error).toBeNull();
      expect(pubRes.published_count).toBe(0);
      expect(pubRes.failed_count).toBe(1);
      expect(pubRes.errors[0].error).toMatch(/Barcode already exists in catalog/i);
    });
  });

  // =========================================================================
  // 6. P2 Zero Opening Stock Invariant Verification (Codex Finding 6)
  // =========================================================================
  describe('P2 Invariant: Zero Opening Stock & Movement Guarantees', () => {
    it('reliably verifies that operational inventory/stock tables do not exist', async () => {
      // 1. inventory_levels must not exist
      const { data: invData, error: invError } = await adminClient
        .from('inventory_levels')
        .select('*');

      expect(invError).not.toBeNull();
      expect(invError?.message || invError?.details).toMatch(
        /relation .* does not exist|could not find the table/i
      );
      expect(invData).toBeNull();

      // 2. stock_movements must not exist
      const { data: smData, error: smError } = await adminClient
        .from('stock_movements')
        .select('*');

      expect(smError).not.toBeNull();
      expect(smError?.message || smError?.details).toMatch(
        /relation .* does not exist|could not find the table/i
      );
      expect(smData).toBeNull();
    });

    it('verifies that staged drafts and published products have no stock quantity fields', async () => {
      const { data: drafts } = await adminClient
        .from('product_drafts')
        .select('*')
        .eq('organization_id', disposableOrgId)
        .limit(10);

      expect(drafts).toBeDefined();
      for (const d of drafts!) {
        const record = d as Record<string, unknown>;
        expect(record.opening_stock_quantity).toBeUndefined();
        expect(record.stock_level).toBeUndefined();
        expect(record.quantity).toBeUndefined();
      }

      const { data: products } = await adminClient
        .from('products')
        .select('*')
        .eq('organization_id', disposableOrgId)
        .limit(10);

      expect(products).toBeDefined();
      for (const p of products!) {
        const record = p as Record<string, unknown>;
        expect(record.opening_stock_quantity).toBeUndefined();
        expect(record.stock_level).toBeUndefined();
        expect(record.quantity).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 7. Audit Trail Verification
  // =========================================================================
  describe('Audit Trail Verification', () => {
    it('records immutable audit log entries for staging, resolution, and publishing', async () => {
      const { data: auditEntries, error } = await adminClient
        .from('audit_logs')
        .select('action, resource, payload')
        .eq('organization_id', disposableOrgId)
        .in('action', ['product_drafts_staged', 'product_draft_resolved', 'product_drafts_published']);

      expect(error).toBeNull();
      expect(auditEntries).toBeDefined();
      expect(auditEntries!.length).toBeGreaterThan(0);

      const stagedLogs = auditEntries!.filter((a) => a.action === 'product_drafts_staged');
      expect(stagedLogs.length).toBeGreaterThan(0);

      const resolvedLogs = auditEntries!.filter((a) => a.action === 'product_draft_resolved');
      expect(resolvedLogs.length).toBeGreaterThan(0);

      const pubLogs = auditEntries!.filter((a) => a.action === 'product_drafts_published');
      expect(pubLogs.length).toBeGreaterThan(0);
    });
  });
});
