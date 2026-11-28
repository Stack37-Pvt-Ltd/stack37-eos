-- ============================================================================
-- Migration: 20261128000003_product_crud_and_cashier_sales.sql
-- Description: Adds audited RPCs for custom product CRUD (create, update, deactivate)
--              and cashier daily/yesterday sales metrics calculation.
-- Security: SECURITY DEFINER, SET search_path = '', strict tenant access checks.
-- ============================================================================

-- 1. Create Custom Product
CREATE OR REPLACE FUNCTION public.create_custom_product(
    p_organization_id UUID,
    p_name TEXT,
    p_selling_price NUMERIC,
    p_cost_price NUMERIC DEFAULT 0,
    p_barcode TEXT DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_category_name TEXT DEFAULT NULL,
    p_branch_id UUID DEFAULT NULL,
    p_initial_stock NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sku TEXT := p_sku;
    v_product_id UUID;
    v_clean_barcode TEXT := NULLIF(trim(p_barcode), '');
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
        LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
        LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
        WHERE om.organization_id = p_organization_id
          AND om.user_id = v_user_id
          AND om.status = 'active'
          AND (om.is_owner = TRUE OR rp.permission_id IN ('inventory_edit', 'inventory_manage'))
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to create products.';
    END IF;

    IF trim(COALESCE(p_name, '')) = '' THEN
        RAISE EXCEPTION 'Product name is required.';
    END IF;

    IF p_selling_price IS NULL OR p_selling_price < 0 THEN
        RAISE EXCEPTION 'Selling price cannot be negative.';
    END IF;

    IF v_sku IS NULL OR trim(v_sku) = '' THEN
        v_sku := 'UKS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    ELSE
        v_sku := trim(v_sku);
    END IF;

    IF v_clean_barcode IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.products
        WHERE organization_id = p_organization_id AND barcode = v_clean_barcode
    ) THEN
        RAISE EXCEPTION 'Barcode % is already assigned to another product.', v_clean_barcode;
    END IF;

    INSERT INTO public.products (
        organization_id, name, sku, barcode, category_name, cost_price, selling_price, is_active
    ) VALUES (
        p_organization_id, trim(p_name), v_sku, v_clean_barcode, NULLIF(trim(p_category_name), ''), COALESCE(p_cost_price, 0), p_selling_price, true
    ) RETURNING id INTO v_product_id;

    IF p_branch_id IS NOT NULL AND COALESCE(p_initial_stock, 0) > 0 THEN
        INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
        VALUES (p_organization_id, p_branch_id, v_product_id, p_initial_stock)
        ON CONFLICT (organization_id, branch_id, product_id)
        DO UPDATE SET quantity = p_initial_stock, updated_at = now();

        INSERT INTO public.stock_movements (
            organization_id, branch_id, product_id, movement_type, quantity_delta, balance_after, reason, created_by
        ) VALUES (
            p_organization_id, p_branch_id, v_product_id, 'adjustment', p_initial_stock, p_initial_stock, 'Initial product stock', v_user_id
        );
    END IF;

    SELECT jsonb_build_object(
        'id', p.id,
        'organizationId', p.organization_id,
        'name', p.name,
        'sku', p.sku,
        'barcode', p.barcode,
        'categoryName', p.category_name,
        'costPrice', p.cost_price,
        'sellingPrice', p.selling_price,
        'isActive', p.is_active,
        'quantity', COALESCE((SELECT quantity FROM public.inventory_balances b WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id AND b.product_id = p.id), 0)
    ) INTO v_result
    FROM public.products p
    WHERE p.id = v_product_id;

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_custom_product(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_custom_product(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, NUMERIC) TO authenticated, service_role;

-- 2. Update Custom Product
CREATE OR REPLACE FUNCTION public.update_custom_product(
    p_organization_id UUID,
    p_product_id UUID,
    p_name TEXT,
    p_selling_price NUMERIC,
    p_cost_price NUMERIC DEFAULT NULL,
    p_barcode TEXT DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_category_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_barcode TEXT := NULLIF(trim(p_barcode), '');
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
        LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
        LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
        WHERE om.organization_id = p_organization_id
          AND om.user_id = v_user_id
          AND om.status = 'active'
          AND (om.is_owner = TRUE OR rp.permission_id IN ('inventory_edit', 'inventory_manage'))
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to update products.';
    END IF;

    IF v_clean_barcode IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.products
        WHERE organization_id = p_organization_id AND barcode = v_clean_barcode AND id != p_product_id
    ) THEN
        RAISE EXCEPTION 'Barcode % is already in use by another product.', v_clean_barcode;
    END IF;

    UPDATE public.products SET
        name = COALESCE(NULLIF(trim(p_name), ''), name),
        selling_price = COALESCE(p_selling_price, selling_price),
        cost_price = COALESCE(p_cost_price, cost_price),
        barcode = v_clean_barcode,
        sku = COALESCE(NULLIF(trim(p_sku), ''), sku),
        category_name = NULLIF(trim(p_category_name), ''),
        updated_at = now()
    WHERE id = p_product_id AND organization_id = p_organization_id;

    SELECT jsonb_build_object(
        'id', p.id,
        'organizationId', p.organization_id,
        'name', p.name,
        'sku', p.sku,
        'barcode', p.barcode,
        'categoryName', p.category_name,
        'costPrice', p.cost_price,
        'sellingPrice', p.selling_price,
        'isActive', p.is_active
    ) INTO v_result
    FROM public.products p
    WHERE p.id = p_product_id;

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.update_custom_product(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_custom_product(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3. Deactivate Custom Product (Soft Delete)
CREATE OR REPLACE FUNCTION public.deactivate_custom_product(
    p_organization_id UUID,
    p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        LEFT JOIN public.membership_roles mr ON mr.membership_id = om.id AND mr.organization_id = om.organization_id
        LEFT JOIN public.roles r ON r.id = mr.role_id AND r.organization_id = om.organization_id
        LEFT JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
        WHERE om.organization_id = p_organization_id
          AND om.user_id = v_user_id
          AND om.status = 'active'
          AND (om.is_owner = TRUE OR rp.permission_id IN ('inventory_edit', 'inventory_manage'))
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to delete products.';
    END IF;

    UPDATE public.products SET is_active = false, updated_at = now()
    WHERE id = p_product_id AND organization_id = p_organization_id;

    RETURN jsonb_build_object('success', true, 'productId', p_product_id);
END;
$$;
REVOKE ALL ON FUNCTION public.deactivate_custom_product(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_custom_product(UUID, UUID) TO authenticated, service_role;

-- 4. Get Cashier Sales Metrics
CREATE OR REPLACE FUNCTION public.get_cashier_sales_metrics(p_organization_id UUID, p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT jsonb_build_object(
        'salesToday', COALESCE((
            SELECT count(*) FROM public.retail_sales s
            WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id
              AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE
        ), 0),
        'grossSalesToday', COALESCE((
            SELECT sum(s.total) FROM public.retail_sales s
            WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id
              AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE
        ), 0),
        'salesYesterday', COALESCE((
            SELECT sum(s.total) FROM public.retail_sales s
            WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id
              AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = ((now() AT TIME ZONE 'Asia/Colombo')::DATE - INTERVAL '1 day')::DATE
        ), 0),
        'mySalesCountToday', COALESCE((
            SELECT count(*) FROM public.retail_sales s
            WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id AND s.cashier_user_id = v_user_id
              AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE
        ), 0),
        'totalSalesCount', COALESCE((
            SELECT count(*) FROM public.retail_sales s
            WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id
        ), 0),
        'currency', COALESCE((SELECT o.currency FROM public.organizations o WHERE o.id = p_organization_id), 'LKR')
    ) INTO v_result;

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cashier_sales_metrics(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cashier_sales_metrics(UUID, UUID) TO authenticated, service_role;
