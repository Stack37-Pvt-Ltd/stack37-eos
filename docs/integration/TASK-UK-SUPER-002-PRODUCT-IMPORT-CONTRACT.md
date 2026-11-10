# STACK37 EOS — Product Draft Staging & Catalog Import Contract
## Tenant-Scoped Staging, Idempotent Ingestion, Anomaly Resolution & Zero-Stock Invariant

**Document Path:** `docs/integration/TASK-UK-SUPER-002-PRODUCT-IMPORT-CONTRACT.md`<br />
**Author:** Google Antigravity (Backend Engineering & System Architecture Owner)<br />
**Target Audience:** Chief Executive Officer, ChatGPT Codex (Frontend/UI Owner), ChatGPT (Product Coordination)<br />
**Task ID:** `TASK-UK-SUPER-002`<br />
**Revision:** 1.1 (Formal Architecture Specification & Contract; Codex re-review correction, November 5, 2026)<br />
**Status:** **HOSTED DRAFT STAGED — READY FOR CEO REVIEW; PRODUCTS NOT PUBLISHED**<br />
**Target Workspace:** New organization `UK Super` (slug `uk-super`; owner `test@stack37.com`; hosted organization ID `ebffb5ca-3262-4cfc-aeea-c29c420587ee`)<br />
**Target Host / Project:** Hosted Supabase project `xbiadendaxhoyrcvaybf`; local verification remains documented separately

---

## 1. Executive Summary & Core Architectural Invariants

The CEO has confirmed a complete export of 21 JSON files containing **2,079 items** (2,079 distinct IDs spanning minimum 6 to maximum 2211) for UK Super (the pilot supermarket tenant). To safely ingest these items into STACK37 EOS without corrupting multi-tenant database constraints or introducing flawed retail code, the backend architecture establishes the following non-negotiable invariants:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SOURCE DATA (LOCAL ONLY)                        │
│          21 JSON Files / 2,079 Source Rows / 2,079 Unique IDs          │
│           Wholesale & Retail in LKR (CEO Confirmed)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Audited RPC: stage_product_drafts)
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGING LAYER: public.product_drafts                 │
│  - Organization-scoped idempotency: (organization_id, file, source_id) │
│  - 100% lossless: preserves raw JSON & all 2,079 source IDs            │
│  - Captures 395 flagged anomaly rows for review                        │
│  - Multi-tenant RLS: strictly partitioned by organization_id           │
│  - ZERO stock balances or movements created                            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       [Review & Resolution RPC]          [Publish to Master Catalog]
       resolve_product_draft(...)         publish_product_drafts(...)
                    │                                │
                    └────────────────► ┌─────────────┴──────────────────┐
                                       │ MASTER CATALOG: public.products│
                                       │ - Validated unique barcodes    │
                                       │ - Deterministic generated SKUs │
                                       │ - Ready for sales & purchasing │
                                       └────────────────────────────────┘
```

### Core Invariants:
1. **Decoupled Staging Foundation:** Staging is architected as an independent foundation (`Migration 14`), completely separated from the unapproved, flawed retail operations migrations 13–15.
2. **Zero Opening Stock Invariant:** Opening stock quantities across all 2,079 products are treated as **strictly unknown**. Staging or publishing products creates **zero** inventory balance rows (`inventory_levels`) and **zero** ledger movements (`stock_movements`). Physical stock balances will be initialized exclusively via an authorized stocktake workflow.
3. **Lossless Traceability:** All 2,079 source records, their raw JSON payloads, file origins, and stable integer source IDs are permanently preserved in `public.product_drafts`. No record is silently dropped, merged, or discarded.
4. **Tenant Isolation (DEC-009):** Every staging and catalog row is strictly partitioned by `organization_id` under PostgreSQL Row Level Security (RLS). Cross-tenant queries return 0 rows; cross-tenant writes are strictly blocked.
5. **Audited Security Definer Ingestion:** No client-side direct table inserts/updates are permitted (`REVOKE ALL FROM authenticated, anon`). All staging, resolving, and publishing actions execute through audited `SECURITY DEFINER` RPCs that authenticate caller membership and log every operation to `public.audit_logs`.

---

## 2. Input Data Contract & Source Characterization

### A. Source Overview
- **Source Files:** 21 JSON files (`items_202611041542.json`, `items_202611041548.json`, and numbered `items_202611041548 (1).json` through `(19).json`).
- **Total Source Rows:** Exactly 2,079 rows.
- **Unique Source IDs:** Exactly 2,079 distinct IDs (minimum 6, maximum 2211 across the 21 source files).
- **Pricing Currency:** Confirmed **Sri Lankan Rupee (LKR)** by the CEO. All prices formatted as `$X,XXX.XX` represent Sri Lankan Rupees and parse to numeric values. Staging preserves up to `NUMERIC(18, 2)` to losslessly capture anomalous source inputs (e.g. ID 114), while catalog publishing requires valid `NUMERIC(12, 2)` values ($< 10^{10}$).

### B. Anomaly Census (395 Flagged Rows)
The data review performed by ChatGPT Codex identified 395 rows with anomalies requiring review flags:

| Review Flag | Count | Root Cause / Data Finding | Backend Staging & Resolution Treatment |
|---|---|---|---|
| `MISSING_BARCODE` | 248 | Barcode field in source was `"-"` or blank. | Stored as `barcode = NULL`. In master catalog, `barcode` remains nullable. Products are identified by generated SKU. |
| `INVALID_BARCODE` | 36 | Barcode string failed numeric barcode format (length not 8–14 digits, or non-numeric characters). | Suggested barcode stored as `NULL`, raw string preserved in `source_raw`. Flagged for manual correction or SKU-only identification. |
| `DUPLICATE_BARCODE` | 84 | 84 products share 34 valid barcode values (e.g. 2 KitKat variants sharing `8901058905113`). | Stored in staging with `barcode` populated and `review_flags` containing `DUPLICATE_BARCODE`. Cannot be published to `products` until resolved (via variant suffix, SKU assignment, or selecting canonical item). |
| `SUGGESTED_NAME_BARCODE_SWAP` | 1 | Source ID 17 has Item Name = `80001157` and Barcode = `"LOACKER CLASSIC PEANUT BUTTER WAFER-45G"`. | Staging suggests swapped values (`name = "LOACKER..."`, `barcode = "80001157"`) while preserving `source_raw`. |
| `NAME_REVIEW` | 1 | Source ID 2138 has numeric item name `3612623025123` and numeric category `3600542449656`. | Retained in staging with `NAME_REVIEW` flag for human editorial review. |
| `CATEGORY_REVIEW` | 9 | Category was empty, `"-"`, or pure numeric string. | Suggested `source_category = NULL`. Raw category retained in `source_raw`. |
| `RETAIL_BELOW_WHOLESALE` | 15 | Retail price is less than wholesale price (negative margin), e.g. ID 114 has Wholesale = `8901058905113` (barcode pasted into price field) and Retail = `0`. | Wholesale and retail prices staged as parsed; flagged `RETAIL_BELOW_WHOLESALE` to prevent selling at corrupt prices. |
| `SOURCE_QUANTITY_IGNORED` | 11 | Source data contained non-zero quantities (10 negative quantities: `-1`, `-2`, `-6`; 1 positive: `2`). | Stock quantity is strictly ignored. `opening_stock_quantity` is `NULL`. Flagged for informational audit only. |

---

## 3. Database Schema Specification (`Migration 14`)

### A. Table: `public.product_drafts` (Staging Layer)
```sql
CREATE TABLE IF NOT EXISTS public.product_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_file TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    source_raw JSONB NOT NULL,
    name TEXT NOT NULL,
    barcode TEXT,
    source_category TEXT,
    company_name TEXT,
    wholesale_price NUMERIC(18, 2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
    retail_price NUMERIC(18, 2) CHECK (retail_price IS NULL OR retail_price >= 0),
    sku TEXT,
    review_flags TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'reviewed', 'resolved', 'published', 'rejected')),
    resolution_notes TEXT,
    staged_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_drafts_org_source UNIQUE (organization_id, source_file, source_id)
);

-- Organization-scoped index for fast filtering by status and flags
CREATE INDEX IF NOT EXISTS idx_product_drafts_org_status
    ON public.product_drafts(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_product_drafts_org_barcode
    ON public.product_drafts(organization_id, barcode)
    WHERE barcode IS NOT NULL;
```

### B. Table: `public.products` (Master Product Catalogue)
```sql
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    category_name TEXT,
    company_name TEXT,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    draft_id UUID REFERENCES public.product_drafts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_org_sku_unique UNIQUE (organization_id, sku)
);

-- Partial unique index: non-null barcodes must be unique within an organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_barcode_unique
    ON public.products(organization_id, barcode)
    WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_org_lookup
    ON public.products(organization_id, name);
```

### C. Zero-Stock Balances & Movements Invariant
- **No `inventory_levels` table or rows are created.**
- **No `stock_movements` table or rows are created.**
- Neither `public.product_drafts` nor `public.products` contains an `opening_stock_quantity` column.
- Physical balances will only be initialized through an explicit stocktake module when authorized.

---

## 4. Multi-Tenant Security & Access Control (DEC-009)

### A. Row Level Security Policies
Both `public.product_drafts` and `public.products` enable Row Level Security:
1. **SELECT Permission:**
   Authenticated users can read drafts and products belonging only to organizations where they hold an `active` membership:
   ```sql
   CREATE POLICY "Active members can view product drafts"
       ON public.product_drafts FOR SELECT
       TO authenticated
       USING (
           organization_id IN (
               SELECT organization_id FROM public.organization_members
               WHERE user_id = auth.uid() AND status = 'active'
           )
       );
   ```
2. **Direct Mutation Prohibition:**
   Direct `INSERT`, `UPDATE`, and `DELETE` on `public.product_drafts` and `public.products` are **revoked** from `authenticated` and `anon`. All mutations must occur via audited `SECURITY DEFINER` RPCs.

---

## 5. Audited `SECURITY DEFINER` RPC Specifications

### A. Ingestion RPC: `public.stage_product_drafts`
**Purpose:** Bulk ingest or update staging draft records idempotently from JSON batches.

```sql
CREATE OR REPLACE FUNCTION public.stage_product_drafts(
    p_organization_id UUID,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

**Parameters:**
- `p_organization_id`: Target workspace UUID.
- `p_items`: JSON array of items conforming to the draft item schema:
  ```json
  [
    {
      "source_file": "items_202611041542.json",
      "source_id": 6,
      "source_raw": { ... },
      "suggested_product": {
        "name": "ORION CHOCO PIE ...",
        "barcode": "8936036025866",
        "source_category": "CHOCOLATE",
        "company_name": null,
        "wholesale_price_lkr": 1200.00,
        "retail_price_lkr": 1680.00,
        "sku": null
      },
      "review_flags": []
    }
  ]
  ```

**Security & Validation:**
1. Validates that the caller is authorized: internal/service_role bypass is allowed; authenticated callers must be active members with `is_owner = true`, role `Administrator` or `Inventory Manager`, or explicit permission `inventory_edit`. Unauthenticated/anonymous callers are strictly rejected.
2. Validates that `p_organization_id` exists.

**Idempotency & Human Review Preservation:**
- Executes `INSERT INTO public.product_drafts ... ON CONFLICT (organization_id, source_file, source_id) DO UPDATE ... WHERE public.product_drafts.status = 'staged' AND public.product_drafts.resolution_notes IS NULL`.
- Untouched staged drafts are updated with incoming source corrections.
- Any draft that has been reviewed (`reviewed`, `resolved`, `rejected`, `published`) or contains human editorial `resolution_notes` is preserved untouched upon re-staging retries.

**Audit Log:**
- Records an entry in `public.audit_logs`:
  `action = 'product_drafts_staged'`, `resource = 'product_drafts'`, `payload = { batch_size, source_files }`.

**Return Contract:**
```json
{
  "success": true,
  "staged_count": 2079,
  "updated_count": 0,
  "flagged_count": 395,
  "flag_summary": {
    "MISSING_BARCODE": 248,
    "DUPLICATE_BARCODE": 84,
    "INVALID_BARCODE": 36,
    "RETAIL_BELOW_WHOLESALE": 15,
    "SOURCE_QUANTITY_IGNORED": 11,
    "CATEGORY_REVIEW": 9,
    "SUGGESTED_NAME_BARCODE_SWAP": 1,
    "NAME_REVIEW": 1
  }
}
```

---

### B. Resolution RPC: `public.resolve_product_draft`
**Purpose:** Update a draft row's fields and transition its review state.

```sql
CREATE OR REPLACE FUNCTION public.resolve_product_draft(
    p_organization_id UUID,
    p_draft_id UUID,
    p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

**Permitted Updates in `p_updates`:**
- `name` (TEXT)
- `barcode` (TEXT or NULL)
- `sku` (TEXT)
- `source_category` (TEXT)
- `wholesale_price` (NUMERIC)
- `retail_price` (NUMERIC)
- `status` (`'reviewed'`, `'resolved'`, `'rejected'`, or `'staged'`)
- `resolution_notes` (TEXT)

**Security:**
- Validates that caller is an active member with `is_owner = true`, role `Administrator` or `Inventory Manager`, or `inventory_edit` permission. Unauthenticated callers are rejected.
- Rejects if draft belongs to another organization.
- Logs resolution event to `public.audit_logs`.

---

### C. Catalog Publishing RPC: `public.publish_product_drafts`
**Purpose:** Publish resolved or clean product drafts into `public.products`.

```sql
CREATE OR REPLACE FUNCTION public.publish_product_drafts(
    p_organization_id UUID,
    p_draft_ids UUID[],
    p_auto_generate_sku BOOLEAN DEFAULT TRUE,
    p_sku_prefix TEXT DEFAULT 'UKS-'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

**Publishing Logic, Eligibility & Batch Protection:**
1. Validates caller permissions for `p_organization_id` (requires `is_owner = true`, `Administrator`, `Inventory Manager`, or `inventory_edit`).
2. Iterates over specified drafts, applying strict eligibility and boundary validations per item without corrupting or aborting the transaction:
   - **Status Check:** Skips already published drafts; rejects rejected drafts.
   - **Review Eligibility:** Rejects drafts with unresolved review flags (`status <> 'resolved' AND cardinality(review_flags) > 0`) with: `"Cannot publish draft with unresolved review flags (...). Resolve draft first."`
   - **Retail Price Validation:** Requires non-null retail price, $0 \le \text{retail\_price} < 10^{10}$ (fitting `NUMERIC(12, 2)`). Rejects missing or out-of-bounds retail prices with item-level error.
   - **Wholesale Price Validation:** If wholesale price is present, requires $0 \le \text{wholesale\_price} < 10^{10}$. Source ID 114 (wholesale price $8,901,058,905,113.00 \ge 10^{10}$) is reported as an item-level price overflow error without aborting or rolling back the rest of the publish batch.
   - **Barcode Conflict Check:** Rejects duplicates within the same batch or against existing catalog items in `public.products`.
   - **SKU Resolution & Uniqueness:** Assigns manual SKU or auto-generates `UKS-XXXXX`. Verifies uniqueness within batch and against catalog.
3. Inserts valid items into `public.products` (casting values to `NUMERIC(12, 2)`).
4. Updates `product_drafts.status = 'published'` and sets `products.draft_id = draft.id`.
5. Logs publication event to `public.audit_logs`.

**Return Contract:**
```json
{
  "success": true,
  "published_count": 2028,
  "failed_count": 51,
  "errors": [
    {
      "draft_id": "...",
      "source_id": 114,
      "wholesale_price": 8901058905113,
      "error": "Wholesale price out of bounds for catalog: must be between 0 and 9,999,999,999.99"
    }
  ]
}
```

---

### D. Summary RPC: `public.get_product_draft_summary`
**Purpose:** Return high-level staging reconciliation statistics for workspace settings / management view.

```sql
CREATE OR REPLACE FUNCTION public.get_product_draft_summary(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

**Security Policy:**
- Read summary policy: permitted to any active member of `p_organization_id`.
- Unauthenticated or non-member callers are strictly rejected with access denied.

---

### E. Explicit Function Privilege Model (Security Definer Hardening)
In accordance with Supabase Advisor 0028 and PostgreSQL privilege specifications:
- Default `PUBLIC` and `anon` execution privileges on all 4 RPCs are explicitly revoked:
  ```sql
  REVOKE ALL ON FUNCTION public.stage_product_drafts(UUID, JSONB) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.stage_product_drafts(UUID, JSONB) TO authenticated, service_role;

  REVOKE ALL ON FUNCTION public.resolve_product_draft(UUID, UUID, JSONB) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.resolve_product_draft(UUID, UUID, JSONB) TO authenticated, service_role;

  REVOKE ALL ON FUNCTION public.publish_product_drafts(UUID, UUID[], BOOLEAN, TEXT) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.publish_product_drafts(UUID, UUID[], BOOLEAN, TEXT) TO authenticated, service_role;

  REVOKE ALL ON FUNCTION public.get_product_draft_summary(UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_product_draft_summary(UUID) TO authenticated, service_role;
  ```
- All functions fail closed if `auth.uid()` is null unless the caller holds the `service_role` or PostgreSQL superuser identity.
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

**Return Contract:**
```json
{
  "organization_id": "<new-uk-super-organization-id>",
  "total_staged": 2079,
  "by_status": {
    "staged": 2079,
    "reviewed": 0,
    "resolved": 0,
    "published": 0,
    "rejected": 0
  },
  "flagged_total": 395,
  "by_flag": {
    "MISSING_BARCODE": 248,
    "DUPLICATE_BARCODE": 84,
    "INVALID_BARCODE": 36,
    "RETAIL_BELOW_WHOLESALE": 15,
    "SOURCE_QUANTITY_IGNORED": 11,
    "CATEGORY_REVIEW": 9,
    "SUGGESTED_NAME_BARCODE_SWAP": 1,
    "NAME_REVIEW": 1
  }
}
```

---

## 6. Local Verification Plan (Local Supabase Stack)

The implementation must be proven exclusively against local Supabase (`http://127.0.0.1:54321` / `127.0.0.1:54322`) via an automated test suite (`tests/integration/product-draft-staging.test.ts`):

1. **Migration Application:** Apply `20261104000014_14_product_draft_staging.sql` to local Supabase.
2. **UK Super Tenant Provisioning:** Create the new organization with name `UK Super`, slug `uk-super`, owner `test@stack37.com`, country `LK`, and the existing public Standard plan through the established `create_business` workflow. Record the generated organization ID. This creates the standard seven-day trial, Headquarters, and default roles.
3. **2,079-Row Exact Ingestion:** Ingest all 2,079 items from `.worktrees/inventory-drafts/TASK-UK-SUPER-002/uk-super-hosted-test-inventory-draft.json` into the new UK Super organization. Confirm database row count equals exactly 2,079.
3. **Idempotent Retry:** Re-execute `stage_product_drafts` with the identical 2,079 rows. Confirm row count remains exactly 2,079 (0 duplicate rows created; `updated_count = 2079`, `staged_count = 0`).
4. **Tenant Isolation:**
   - User from Org A queries `product_drafts` -> receives 2,079 rows.
   - User from Org B queries `product_drafts` -> receives 0 rows.
   - User from Org B calls `stage_product_drafts` or `resolve_product_draft` for Org A -> rejected with HTTP 403 / unauthorized error.
5. **Zero Inventory Side-Effects:** Verify that `information_schema.tables` contains NO `inventory_levels` or `stock_movements`, and zero stock movements have occurred.
6. **Conflict Resolution & Publishing:**
   - Attempt publishing duplicate barcode rows -> verify conflict rejection.
   - Resolve conflict using `resolve_product_draft`.
   - Publish clean batch with auto-generated SKUs (`UKS-00006`, etc.) -> verify `public.products` populated and linked to drafts.
7. **Audit Logging:** Confirm audit records exist in `public.audit_logs`.

---

## 7. CEO Authorization & Deployment Gate

- **Local Verification Only:** All schema creation and staging verification are confined strictly to local Supabase.
- **Hosted Project Protection:** Remote database `xbiadendaxhoyrcvaybf` remains untouched.
- **Git Protection:** Zero commits, pushes, or deployments will be made without explicit CEO authorization.
