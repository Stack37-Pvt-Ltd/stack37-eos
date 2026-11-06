# TASK-UK-SUPER-002 — Product Draft Staging & Catalog Import Proposal
## Security-Hardened Backend Proposal (Resolving CODEX-BACKEND-REVIEW Findings)

**Date:** November 4, 2026 (Asia/Colombo)<br />
**Author:** Google Antigravity (Backend Engineering & System Architecture Owner)<br />
**Target Audience:** Chief Executive Officer, ChatGPT Codex (Frontend/UI Owner), ChatGPT (Product Coordination)<br />
**Status:** **READY FOR CODEX RE-REVIEW & CEO REVIEW — LOCAL RE-VERIFICATION COMPLETED**<br />
**Authorization Boundary:** Local disposable Supabase verification only. Zero remote migrations, hosted writes (`xbiadendaxhoyrcvaybf`), commits, pushes, or deployments executed.

---

## 1. Executive Summary & Resolution of Codex Findings

In response to the independent review in [`docs/reviews/TASK-UK-SUPER-002/CODEX-BACKEND-REVIEW.md`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/reviews/TASK-UK-SUPER-002/CODEX-BACKEND-REVIEW.md), Google Antigravity has resolved all release-blocking (P0/P1) and evidence/contract (P2) findings.

All fixes were applied to candidate Migration 14 ([`supabase/migrations/20261104000014_14_product_draft_staging.sql`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/supabase/migrations/20261104000014_14_product_draft_staging.sql)), the integration test suite ([`tests/integration/product-draft-staging.test.ts`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/tests/integration/product-draft-staging.test.ts)), and the architecture contract ([`docs/integration/TASK-UK-SUPER-002-PRODUCT-IMPORT-CONTRACT.md`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/integration/TASK-UK-SUPER-002-PRODUCT-IMPORT-CONTRACT.md)). Retesting was conducted **strictly against a dedicated disposable local Supabase organization** with zero mutation to the permanent `test` organization.

### Summary of Resolutions:

| Finding ID | Severity | Codex Review Item | Antigravity Backend Fix & Verification |
|---|---|---|---|
| **Finding 1** | **P0** | **Anonymous execution of privileged RPCs:** Functions declared `SECURITY DEFINER` ran as owner `postgres`, causing `current_user NOT IN ('postgres', 'service_role')` to evaluate to `false` for unauthenticated callers. | Added explicit `REVOKE ALL ... FROM PUBLIC, anon;` and `GRANT EXECUTE ... TO authenticated, service_role;` for all 4 RPCs. Updated caller logic to fail closed if `auth.uid()` is null (unless caller has `service_role` / PostgreSQL superuser identity). Verified via `has_function_privilege('anon', ...)` and automated integration tests with an unauthenticated `anonClient`. |
| **Finding 2** | **P1** | **Active member role check:** Active membership alone is insufficient for catalog mutations; requires owner or inventory management role/capability. | Seeded `inventory_edit` permission in `public.permissions` and granted to `Administrator` role. Mutation RPCs (`stage_product_drafts`, `resolve_product_draft`, `publish_product_drafts`) now enforce `om.is_owner = true OR r.name IN ('Administrator', 'Inventory Manager') OR rp.permission_id = 'inventory_edit'`. Read summary (`get_product_draft_summary`) remains accessible to any active member. Verified with dedicated non-admin member client. |
| **Finding 3** | **P1** | **Publishing anomaly review & price overflow:** `publish_product_drafts` skipped review flags and did not protect against numeric column overflow (e.g. ID 114 wholesale price `8,901,058,905,113.00` overflowing `NUMERIC(12, 2)`). | Added strict publishing eligibility: rejects drafts with unresolved review flags (`status <> 'resolved' AND cardinality(review_flags) > 0`). Enforced price bounds: retail price required $\ge 0$ and $< 10^{10}$; wholesale price $< 10^{10}$. Source ID 114 is reported as an item-level overflow error without aborting or rolling back the rest of the publish batch. |
| **Finding 4** | **P1** | **Re-staging erases review work:** Upsert overwrote corrected fields for any draft except `published`. | Restricted upsert update condition: `WHERE public.product_drafts.status = 'staged' AND public.product_drafts.resolution_notes IS NULL`. Re-staging retries now preserve human editorial corrections, resolution notes, and reviewed/resolved/rejected states. Verified by resolving Item 17 and re-staging the original source item. |
| **Finding 5** | **P1** | **Test safety & disposable organization:** Test accepted environment URLs without verifying localhost; setup deleted all data for `test` organization. | Added top-level loopback safety guard asserting `['127.0.0.1', 'localhost', '::1'].includes(hostname)` (fails closed immediately). Replaced shared workspace with a dynamically provisioned disposable organization (`dispstage...`) created in `beforeAll` and destroyed in `afterAll`. The main `test` organization data is never touched. |
| **Finding 6** | **P2** | **Zero-stock verification:** PostgREST query on `information_schema.tables` ignored errors and treated null data as zero-row success. | Replaced with direct table selects against `inventory_levels` and `stock_movements`, asserting that PostgREST returns table-not-found / relation-does-not-exist errors. Asserted that neither draft nor product rows contain opening stock fields. |
| **Finding 7** | **P2** | **Source ID range & reconciliation:** Proposal stated `1–2140` instead of min 6, max 2211; contract staging price columns said `NUMERIC(12, 2)`. | Corrected proposal and contract to state min ID 6 and max ID 2211 (2,079 distinct IDs). Corrected staging price columns in contract to `NUMERIC(18, 2)` (catalog `products` retains `NUMERIC(12, 2)`). Updated test suite to verify the exact set of 2,079 `(source_file, source_id)` pairs and per-file counts against the source JSON manifest. |

---

## 2. Updated Database Migration (`Migration 14`)

File: [`supabase/migrations/20261104000014_14_product_draft_staging.sql`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/supabase/migrations/20261104000014_14_product_draft_staging.sql)

### Key Architectural Invariants Implemented:
1. **Lossless Staging Table:** `public.product_drafts` with `NUMERIC(18, 2)` wholesale/retail prices to capture anomalous inputs losslessly, and unique constraint `uq_product_drafts_org_source UNIQUE (organization_id, source_file, source_id)`.
2. **Master Catalog Table:** `public.products` with `NUMERIC(12, 2)` prices ($< 10^{10}$) and unique constraints on `(organization_id, sku)` and non-null `(organization_id, barcode)`.
3. **Multi-Tenant RLS:** Both tables enable RLS; direct `INSERT`, `UPDATE`, and `DELETE` revoked from all client roles. Authenticated active members can `SELECT` only their own organization's data.
4. **Audited Security Definer RPCs:**
   - `public.stage_product_drafts(p_organization_id UUID, p_items JSONB) RETURNS JSONB`
   - `public.resolve_product_draft(p_organization_id UUID, p_draft_id UUID, p_updates JSONB) RETURNS JSONB`
   - `public.publish_product_drafts(p_organization_id UUID, p_draft_ids UUID[], p_auto_generate_sku BOOLEAN, p_sku_prefix TEXT) RETURNS JSONB`
   - `public.get_product_draft_summary(p_organization_id UUID) RETURNS JSONB`
5. **Security Definer Hardening:** Explicit `REVOKE ALL ... FROM PUBLIC, anon;` and `GRANT EXECUTE ... TO authenticated, service_role;` on all 4 signatures.

---

## 3. Local Disposable Supabase Verification Evidence

Verified using automated integration test suite [`tests/integration/product-draft-staging.test.ts`](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/tests/integration/product-draft-staging.test.ts) running against a dedicated disposable local workspace:

```
 RUN  v3.0.7 C:/Users/nimth/Desktop/Developments/stack37-eos

 ✓ tests/integration/product-draft-staging.test.ts (20 tests) 5780ms
   ✓ P0 Security: Anonymous RPC Protection > rejects unauthenticated/anon call to stage_product_drafts
   ✓ P0 Security: Anonymous RPC Protection > rejects unauthenticated/anon call to resolve_product_draft
   ✓ P0 Security: Anonymous RPC Protection > rejects unauthenticated/anon call to publish_product_drafts
   ✓ P0 Security: Anonymous RPC Protection > rejects unauthenticated/anon call to get_product_draft_summary
   ✓ P1 Security: Role-Based Access Control > rejects stage_product_drafts from active member lacking owner/inventory role
   ✓ P1 Security: Role-Based Access Control > rejects resolve_product_draft from active member lacking owner/inventory role
   ✓ P1 Security: Role-Based Access Control > rejects publish_product_drafts from active member lacking owner/inventory role
   ✓ P1 Security: Role-Based Access Control > allows active member to view get_product_draft_summary (read summary policy)
   ✓ P1 Security: Role-Based Access Control > rejects outsider from executing any RPC or reading drafts via RLS
   ✓ Staging Ingestion & Manifest Reconciliation > stages all 2,079 source items via stage_product_drafts RPC in chunks
   ✓ Staging Ingestion & Manifest Reconciliation > reconciles exact set of 2,079 (source_file, source_id) tuples and per-file counts
   ✓ Staging Ingestion & Manifest Reconciliation > matches expected review flag distribution
   ✓ P1 Review Preservation: Re-staging Protection > preserves reviewed/resolved status and human notes during subsequent re-staging
   ✓ P1 Catalog Publishing: Validation & Batch Protection > rejects publishing an unreviewed flagged draft with item-level error
   ✓ P1 Catalog Publishing: Validation & Batch Protection > rejects draft with price overflow (Source ID 114) without aborting the batch
   ✓ P1 Catalog Publishing: Validation & Batch Protection > rejects publishing drafts with missing retail price
   ✓ P1 Catalog Publishing: Validation & Batch Protection > rejects publishing when barcode conflicts with an already published product
   ✓ P2 Invariant: Zero Opening Stock & Movement Guarantees > reliably verifies that operational inventory/stock tables do not exist
   ✓ P2 Invariant: Zero Opening Stock & Movement Guarantees > verifies that staged drafts and published products have no stock quantity fields
   ✓ Audit Trail Verification > records immutable audit log entries for staging, resolution, and publishing

 Test Files  1 passed (1)
      Tests  20 passed (20)
   Duration  7.85s
```

### Manifest Reconciliation Summary:
- **Total Source Files:** 21 JSON files.
- **Total Staged Items:** Exactly 2,079 rows.
- **Source ID Range:** Minimum 6, Maximum 2211 (2,079 distinct IDs matching source draft).
- **Per-File Row Counts:** 100% matched across all 21 source files.
- **Flagged Rows Census:** Exactly 395 flagged rows:
  - `MISSING_BARCODE`: 248
  - `DUPLICATE_BARCODE`: 84
  - `INVALID_BARCODE`: 36
  - `RETAIL_BELOW_WHOLESALE`: 15
  - `SOURCE_QUANTITY_IGNORED`: 11
  - `CATEGORY_REVIEW`: 9
  - `SUGGESTED_NAME_BARCODE_SWAP`: 1
  - `NAME_REVIEW`: 1

### Full Repository Regression Verification:
- Unit Test Suite (`npm run test:unit`): **215/215 PASS** across 14 test files.
- Integration Test Suite (`npx vitest run tests/integration/product-draft-staging.test.ts`): **20/20 PASS**.
- TypeScript (`npm run typecheck`): **PASS (0 errors)**.
- ESLint (`npm run lint`): **PASS (0 errors, 0 warnings)**.
- Whitespace check (`git diff --check`): **PASS (0 errors)**.

---

## 4. Current Status & Operating Boundary

- **Task Status:** `READY_FOR_REVIEW` (Handed back for ChatGPT Codex re-review).
- **Local Isolation:** Candidate Migration 14 and all test artifacts remain local.
- **Remote Isolation:** Hosted project `xbiadendaxhoyrcvaybf` was NOT touched (zero remote migrations, zero hosted writes).
- **Git State:** Preserved uncommitted changes; zero commits, pushes, or deployments executed.
