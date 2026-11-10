-- ============================================================================
-- Migration: 20261104000014_14_product_draft_staging.sql
-- Description: Minimal tenant-scoped product staging layer, master catalogue,
--              audited idempotent RPCs, and zero-opening-stock invariant for
--              inventory draft onboarding (TASK-UK-SUPER-002).
-- Author: Google Antigravity (Backend Engineering & System Architecture Owner)
-- Governance: STACK37 EOS Multi-Tenancy (DEC-001, DEC-005, DEC-009)
-- Status: CANDIDATE SCHEMA (Verified against local Supabase; hosted deploy deferred)
-- Security Hardened: Full resolution of CODEX-BACKEND-REVIEW findings (P0/P1/P2)
-- ============================================================================

-- 1. Reference Permissions & Roles Initialization
INSERT INTO public.permissions (id, module_name, action)
VALUES ('inventory_edit', 'inventory', 'edit')
ON CONFLICT (id) DO NOTHING;

-- Grant inventory_edit to existing Administrator roles
INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, 'inventory_edit'
FROM public.roles r
WHERE r.name = 'Administrator'
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- 2. Product Draft Staging Layer
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

CREATE INDEX IF NOT EXISTS idx_product_drafts_org_status
    ON public.product_drafts(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_product_drafts_org_barcode
    ON public.product_drafts(organization_id, barcode)
    WHERE barcode IS NOT NULL;

-- 3. Master Product Catalogue
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_barcode_unique
    ON public.products(organization_id, barcode)
    WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_org_name
    ON public.products(organization_id, name);

-- ============================================================================
-- Row Level Security (RLS) Policies (DEC-009)
-- ============================================================================

ALTER TABLE public.product_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_drafts FROM public, anon, authenticated;
GRANT SELECT ON public.product_drafts TO authenticated;

REVOKE ALL ON public.products FROM public, anon, authenticated;
GRANT SELECT ON public.products TO authenticated;

DROP POLICY IF EXISTS "Active members can view product drafts" ON public.product_drafts;
CREATE POLICY "Active members can view product drafts"
    ON public.product_drafts FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "Active members can view products" ON public.products;
CREATE POLICY "Active members can view products"
    ON public.products FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- ============================================================================
-- Security Definer RPCs
-- ============================================================================

-- A. stage_product_drafts (Idempotent Bulk Ingestion)
CREATE OR REPLACE FUNCTION public.stage_product_drafts(
    p_organization_id UUID,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staged_count INT := 0;
    v_flagged_count INT := 0;
    v_flag_summary JSONB;
BEGIN
    -- 1. Authorization check (Fail closed for unauthenticated / unauthorized callers)
    IF auth.role() = 'service_role' OR session_user IN ('postgres', 'service_role') THEN
        NULL; -- Internal / service role bypass
    ELSIF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members om
            LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
            LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
            LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
            WHERE om.organization_id = p_organization_id
              AND om.user_id = auth.uid()
              AND om.status = 'active'
              AND (
                  om.is_owner = true
                  OR r.name IN ('Administrator', 'Inventory Manager')
                  OR rp.permission_id = 'inventory_edit'
              )
        ) THEN
            RAISE EXCEPTION 'Access denied: requires owner or administrator role in organization %', p_organization_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Access denied: unauthenticated caller';
    END IF;

    -- 2. Validate organization exists
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
        RAISE EXCEPTION 'Organization % not found', p_organization_id;
    END IF;

    -- 3. Idempotent Upsert into product_drafts
    -- Human review preservation: only update drafts that are still untouched ('staged' with no resolution notes).
    INSERT INTO public.product_drafts (
        organization_id,
        source_file,
        source_id,
        source_raw,
        name,
        barcode,
        source_category,
        company_name,
        wholesale_price,
        retail_price,
        sku,
        review_flags,
        status,
        staged_by,
        updated_at
    )
    SELECT
        p_organization_id,
        (item->>'source_file')::TEXT,
        (item->>'source_id')::INT,
        item->'source_raw',
        COALESCE(NULLIF(TRIM(item->'suggested_product'->>'name'), ''), 'Unnamed Item'),
        NULLIF(TRIM(item->'suggested_product'->>'barcode'), ''),
        NULLIF(TRIM(item->'suggested_product'->>'source_category'), ''),
        NULLIF(TRIM(item->'suggested_product'->>'company_name'), ''),
        CASE
            WHEN item->'suggested_product'->>'wholesale_price_lkr' IS NOT NULL
            THEN (item->'suggested_product'->>'wholesale_price_lkr')::NUMERIC(18, 2)
            ELSE NULL
        END,
        CASE
            WHEN item->'suggested_product'->>'retail_price_lkr' IS NOT NULL
            THEN (item->'suggested_product'->>'retail_price_lkr')::NUMERIC(18, 2)
            ELSE NULL
        END,
        NULLIF(TRIM(item->'suggested_product'->>'sku'), ''),
        COALESCE(
            (
                SELECT array_agg(elem::TEXT)
                FROM jsonb_array_elements_text(COALESCE(item->'review_flags', '[]'::jsonb)) AS elem
            ),
            '{}'::TEXT[]
        ),
        'staged',
        auth.uid(),
        now()
    FROM jsonb_array_elements(p_items) AS item
    ON CONFLICT (organization_id, source_file, source_id) DO UPDATE SET
        source_raw = EXCLUDED.source_raw,
        name = EXCLUDED.name,
        barcode = EXCLUDED.barcode,
        source_category = EXCLUDED.source_category,
        company_name = EXCLUDED.company_name,
        wholesale_price = EXCLUDED.wholesale_price,
        retail_price = EXCLUDED.retail_price,
        sku = COALESCE(public.product_drafts.sku, EXCLUDED.sku),
        review_flags = EXCLUDED.review_flags,
        updated_at = now()
    WHERE public.product_drafts.status = 'staged'
      AND public.product_drafts.resolution_notes IS NULL;

    -- 4. Calculate total staged and flagged counts for organization
    SELECT count(*) INTO v_staged_count
    FROM public.product_drafts
    WHERE organization_id = p_organization_id;

    SELECT count(*) INTO v_flagged_count
    FROM public.product_drafts
    WHERE organization_id = p_organization_id
      AND cardinality(review_flags) > 0;

    -- 5. Calculate flag summary breakdown
    SELECT jsonb_object_agg(flag, cnt) INTO v_flag_summary
    FROM (
        SELECT unnest(review_flags) AS flag, count(*) AS cnt
        FROM public.product_drafts
        WHERE organization_id = p_organization_id
        GROUP BY 1
    ) AS f;

    -- 6. Audit Logging
    INSERT INTO public.audit_logs (
        organization_id,
        actor_id,
        action,
        resource,
        payload
    )
    VALUES (
        p_organization_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'product_drafts_staged',
        'product_drafts',
        jsonb_build_object(
            'batch_size', jsonb_array_length(p_items),
            'total_staged', v_staged_count,
            'flagged_count', v_flagged_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_size', jsonb_array_length(p_items),
        'total_staged', v_staged_count,
        'flagged_count', v_flagged_count,
        'flag_summary', COALESCE(v_flag_summary, '{}'::jsonb)
    );
END;
$$;

-- B. resolve_product_draft (Resolution & Editorial RPC)
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
DECLARE
    v_draft RECORD;
    v_new_status TEXT;
BEGIN
    -- 1. Authorization check
    IF auth.role() = 'service_role' OR session_user IN ('postgres', 'service_role') THEN
        NULL;
    ELSIF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members om
            LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
            LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
            LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
            WHERE om.organization_id = p_organization_id
              AND om.user_id = auth.uid()
              AND om.status = 'active'
              AND (
                  om.is_owner = true
                  OR r.name IN ('Administrator', 'Inventory Manager')
                  OR rp.permission_id = 'inventory_edit'
              )
        ) THEN
            RAISE EXCEPTION 'Access denied: requires owner or administrator role in organization %', p_organization_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Access denied: unauthenticated caller';
    END IF;

    -- 2. Fetch existing draft
    SELECT * INTO v_draft
    FROM public.product_drafts
    WHERE id = p_draft_id AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product draft % not found for organization %', p_draft_id, p_organization_id;
    END IF;

    IF v_draft.status = 'published' THEN
        RAISE EXCEPTION 'Cannot edit published draft %', p_draft_id;
    END IF;

    v_new_status := COALESCE(p_updates->>'status', 'resolved');
    IF v_new_status NOT IN ('staged', 'reviewed', 'resolved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid resolution status %', v_new_status;
    END IF;

    -- 3. Apply updates
    UPDATE public.product_drafts
    SET
        name = COALESCE(p_updates->>'name', name),
        barcode = CASE
            WHEN p_updates ? 'barcode' THEN NULLIF(TRIM(p_updates->>'barcode'), '')
            ELSE barcode
        END,
        sku = CASE
            WHEN p_updates ? 'sku' THEN NULLIF(TRIM(p_updates->>'sku'), '')
            ELSE sku
        END,
        source_category = CASE
            WHEN p_updates ? 'source_category' THEN NULLIF(TRIM(p_updates->>'source_category'), '')
            ELSE source_category
        END,
        company_name = CASE
            WHEN p_updates ? 'company_name' THEN NULLIF(TRIM(p_updates->>'company_name'), '')
            ELSE company_name
        END,
        wholesale_price = CASE
            WHEN p_updates ? 'wholesale_price' THEN (p_updates->>'wholesale_price')::NUMERIC(18, 2)
            ELSE wholesale_price
        END,
        retail_price = CASE
            WHEN p_updates ? 'retail_price' THEN (p_updates->>'retail_price')::NUMERIC(18, 2)
            ELSE retail_price
        END,
        status = v_new_status,
        resolution_notes = COALESCE(p_updates->>'resolution_notes', resolution_notes),
        updated_at = now()
    WHERE id = p_draft_id;

    -- 4. Audit Log
    INSERT INTO public.audit_logs (
        organization_id,
        actor_id,
        action,
        resource,
        payload
    )
    VALUES (
        p_organization_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'product_draft_resolved',
        'product_drafts',
        jsonb_build_object(
            'draft_id', p_draft_id,
            'new_status', v_new_status,
            'updates', p_updates
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'draft_id', p_draft_id,
        'status', v_new_status
    );
END;
$$;

-- C. publish_product_drafts (Publish to Master Product Catalog)
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
DECLARE
    v_draft RECORD;
    v_published_count INT := 0;
    v_failed_count INT := 0;
    v_errors JSONB := '[]'::jsonb;
    v_sku TEXT;
    v_product_id UUID;
    v_batch_barcodes TEXT[] := '{}';
    v_batch_skus TEXT[] := '{}';
BEGIN
    -- 1. Authorization check
    IF auth.role() = 'service_role' OR session_user IN ('postgres', 'service_role') THEN
        NULL;
    ELSIF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members om
            LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
            LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
            LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
            WHERE om.organization_id = p_organization_id
              AND om.user_id = auth.uid()
              AND om.status = 'active'
              AND (
                  om.is_owner = true
                  OR r.name IN ('Administrator', 'Inventory Manager')
                  OR rp.permission_id = 'inventory_edit'
              )
        ) THEN
            RAISE EXCEPTION 'Access denied: requires owner or administrator role in organization %', p_organization_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Access denied: unauthenticated caller';
    END IF;

    -- 2. Process specified drafts
    FOR v_draft IN
        SELECT *
        FROM public.product_drafts
        WHERE id = ANY(p_draft_ids)
          AND organization_id = p_organization_id
        ORDER BY source_id ASC
    LOOP
        -- Check if already published
        IF v_draft.status = 'published' THEN
            CONTINUE;
        END IF;

        -- Check if draft was rejected
        IF v_draft.status = 'rejected' THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'error', 'Cannot publish rejected draft'
            );
            CONTINUE;
        END IF;

        -- Enforce review eligibility: must be resolved OR clean with 0 review flags
        IF v_draft.status <> 'resolved' AND cardinality(v_draft.review_flags) > 0 THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'review_flags', to_jsonb(v_draft.review_flags),
                'error', 'Cannot publish draft with unresolved review flags (' || array_to_string(v_draft.review_flags, ', ') || '). Resolve draft first.'
            );
            CONTINUE;
        END IF;

        -- Enforce retail selling price requirements: must be provided, >= 0, and < 10^10 (numeric(12, 2))
        IF v_draft.retail_price IS NULL OR v_draft.retail_price < 0 OR v_draft.retail_price >= 10000000000 THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'retail_price', v_draft.retail_price,
                'error', 'Retail selling price must be provided and between 0 and 9,999,999,999.99'
            );
            CONTINUE;
        END IF;

        -- Enforce wholesale cost price bounds: if provided, must be >= 0 and < 10^10 (numeric(12, 2))
        IF v_draft.wholesale_price IS NOT NULL AND (v_draft.wholesale_price < 0 OR v_draft.wholesale_price >= 10000000000) THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'wholesale_price', v_draft.wholesale_price,
                'error', 'Wholesale price out of bounds for catalog: must be between 0 and 9,999,999,999.99'
            );
            CONTINUE;
        END IF;

        -- Check barcode conflicts
        IF v_draft.barcode IS NOT NULL THEN
            IF v_draft.barcode = ANY(v_batch_barcodes) THEN
                v_failed_count := v_failed_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'draft_id', v_draft.id,
                    'source_id', v_draft.source_id,
                    'barcode', v_draft.barcode,
                    'error', 'Duplicate barcode within publish batch'
                );
                CONTINUE;
            END IF;

            IF EXISTS (
                SELECT 1 FROM public.products
                WHERE organization_id = p_organization_id
                  AND barcode = v_draft.barcode
            ) THEN
                v_failed_count := v_failed_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'draft_id', v_draft.id,
                    'source_id', v_draft.source_id,
                    'barcode', v_draft.barcode,
                    'error', 'Barcode already exists in catalog'
                );
                CONTINUE;
            END IF;
        END IF;

        -- Resolve SKU
        IF v_draft.sku IS NOT NULL THEN
            v_sku := v_draft.sku;
        ELSIF p_auto_generate_sku THEN
            v_sku := p_sku_prefix || lpad(v_draft.source_id::TEXT, 5, '0');
        ELSE
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'error', 'Missing SKU and auto-generation disabled'
            );
            CONTINUE;
        END IF;

        -- Check SKU uniqueness in current batch
        IF v_sku = ANY(v_batch_skus) THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'sku', v_sku,
                'error', 'Duplicate SKU within publish batch'
            );
            CONTINUE;
        END IF;

        -- Check SKU uniqueness against existing products in this org
        IF EXISTS (
            SELECT 1 FROM public.products
            WHERE organization_id = p_organization_id
              AND sku = v_sku
        ) THEN
            v_failed_count := v_failed_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'draft_id', v_draft.id,
                'source_id', v_draft.source_id,
                'sku', v_sku,
                'error', 'SKU already exists in catalog'
            );
            CONTINUE;
        END IF;

        -- Insert into public.products with numeric(12, 2) values
        INSERT INTO public.products (
            organization_id,
            name,
            sku,
            barcode,
            category_name,
            company_name,
            cost_price,
            selling_price,
            is_active,
            draft_id
        )
        VALUES (
            p_organization_id,
            v_draft.name,
            v_sku,
            v_draft.barcode,
            v_draft.source_category,
            v_draft.company_name,
            COALESCE(v_draft.wholesale_price, 0.00)::NUMERIC(12, 2),
            v_draft.retail_price::NUMERIC(12, 2),
            true,
            v_draft.id
        )
        RETURNING id INTO v_product_id;

        -- Update draft status
        UPDATE public.product_drafts
        SET
            status = 'published',
            sku = v_sku,
            updated_at = now()
        WHERE id = v_draft.id;

        v_published_count := v_published_count + 1;

        -- Track assigned barcodes and SKUs within batch
        IF v_draft.barcode IS NOT NULL THEN
            v_batch_barcodes := array_append(v_batch_barcodes, v_draft.barcode);
        END IF;
        v_batch_skus := array_append(v_batch_skus, v_sku);
    END LOOP;

    -- 3. Audit Log
    INSERT INTO public.audit_logs (
        organization_id,
        actor_id,
        action,
        resource,
        payload
    )
    VALUES (
        p_organization_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'product_drafts_published',
        'products',
        jsonb_build_object(
            'published_count', v_published_count,
            'failed_count', v_failed_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'published_count', v_published_count,
        'failed_count', v_failed_count,
        'errors', v_errors
    );
END;
$$;

-- D. get_product_draft_summary (Read Summary for Workspace Members)
CREATE OR REPLACE FUNCTION public.get_product_draft_summary(
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total INT := 0;
    v_by_status JSONB;
    v_flagged_count INT := 0;
    v_by_flag JSONB;
BEGIN
    -- 1. Authorization check: Any active member of the organization may read the staging summary
    IF auth.role() = 'service_role' OR session_user IN ('postgres', 'service_role') THEN
        NULL;
    ELSIF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = p_organization_id
              AND user_id = auth.uid()
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Access denied: not an active member of organization %', p_organization_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Access denied: unauthenticated caller';
    END IF;

    SELECT count(*) INTO v_total
    FROM public.product_drafts
    WHERE organization_id = p_organization_id;

    SELECT jsonb_object_agg(status, cnt) INTO v_by_status
    FROM (
        SELECT status, count(*) AS cnt
        FROM public.product_drafts
        WHERE organization_id = p_organization_id
        GROUP BY 1
    ) AS s;

    SELECT count(*) INTO v_flagged_count
    FROM public.product_drafts
    WHERE organization_id = p_organization_id
      AND cardinality(review_flags) > 0;

    SELECT jsonb_object_agg(flag, cnt) INTO v_by_flag
    FROM (
        SELECT unnest(review_flags) AS flag, count(*) AS cnt
        FROM public.product_drafts
        WHERE organization_id = p_organization_id
        GROUP BY 1
    ) AS f;

    RETURN jsonb_build_object(
        'organization_id', p_organization_id,
        'total_staged', v_total,
        'by_status', COALESCE(v_by_status, '{}'::jsonb),
        'flagged_total', v_flagged_count,
        'by_flag', COALESCE(v_by_flag, '{}'::jsonb)
    );
END;
$$;

-- ============================================================================
-- Explicit Function Execution Privileges (Security Hardening - P0 / Advisors)
-- ============================================================================

REVOKE ALL ON FUNCTION public.stage_product_drafts(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_product_drafts(UUID, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_product_draft(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_product_draft(UUID, UUID, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.publish_product_drafts(UUID, UUID[], BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_product_drafts(UUID, UUID[], BOOLEAN, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_product_draft_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_draft_summary(UUID) TO authenticated, service_role;
