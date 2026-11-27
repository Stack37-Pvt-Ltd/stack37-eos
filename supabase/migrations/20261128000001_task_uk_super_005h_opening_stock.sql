-- Migration: 20261128000001_task_uk_super_005h_opening_stock.sql
-- Description: Task UK-SUPER-005H Bulk Opening Stocktake for Retail Operations
-- Author: Google Antigravity (Backend Engineering Owner)

CREATE OR REPLACE FUNCTION public.bulk_record_opening_stock(
  p_organization_id UUID,
  p_branch_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owner BOOLEAN;
  v_item RECORD;
  v_product_id UUID;
  v_new_qty NUMERIC(14, 3);
  v_current_qty NUMERIC(14, 3);
  v_delta NUMERIC(14, 3);
  v_count INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. Check permissions: Owner or inventory_edit permission
  SELECT om.is_owner INTO v_is_owner
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id
    AND om.user_id = v_user_id
    AND om.status = 'active';

  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_permission(p_organization_id, 'inventory_edit') THEN
    RAISE EXCEPTION 'You do not have permission to record opening stock.';
  END IF;

  -- 2. Verify branch belongs to organization and caller has access
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id AND b.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'The operating branch does not belong to this organization.';
  END IF;

  IF NOT private.has_branch_access(p_organization_id, p_branch_id) THEN
    RAISE EXCEPTION 'You are not assigned to this operating branch.';
  END IF;

  -- 3. Validate items array
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items payload must be a non-empty JSON array.';
  END IF;

  IF jsonb_array_length(p_items) > 5000 THEN
    RAISE EXCEPTION 'Items payload exceeds maximum batch size of 5000.';
  END IF;

  -- 4. Process each stocktake item
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID AS product_id,
      (elem->>'quantity')::NUMERIC(14, 3) AS quantity
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    v_product_id := v_item.product_id;
    v_new_qty := v_item.quantity;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Each item must specify a valid product_id.';
    END IF;

    IF v_new_qty IS NULL OR v_new_qty < 0 OR v_new_qty > 1000000 THEN
      RAISE EXCEPTION 'Quantity for product % must be between 0 and 1,000,000.', v_product_id;
    END IF;

    -- Verify product exists, belongs to target organization, and is active
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_product_id
        AND p.is_active = true
    ) THEN
      RAISE EXCEPTION 'Product % does not exist or is not active in this organization.', v_product_id;
    END IF;

    -- Fetch current balance
    SELECT quantity INTO v_current_qty
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id
      AND branch_id = p_branch_id
      AND product_id = v_product_id;

    IF v_current_qty IS NULL THEN
      v_current_qty := 0;
      INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
      VALUES (p_organization_id, p_branch_id, v_product_id, v_new_qty)
      ON CONFLICT (organization_id, branch_id, product_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();
    ELSE
      UPDATE public.inventory_balances
      SET quantity = v_new_qty, updated_at = now()
      WHERE organization_id = p_organization_id
        AND branch_id = p_branch_id
        AND product_id = v_product_id;
    END IF;

    -- Record stock movement if delta is non-zero
    v_delta := v_new_qty - v_current_qty;
    IF v_delta <> 0 THEN
      INSERT INTO public.stock_movements (
        organization_id,
        branch_id,
        product_id,
        movement_type,
        quantity_delta,
        reason,
        actor_user_id
      ) VALUES (
        p_organization_id,
        p_branch_id,
        v_product_id,
        'adjustment',
        v_delta,
        'opening_stocktake',
        v_user_id
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- 5. Insert audit log
  PERFORM private.insert_audit_log(
    p_organization_id,
    'inventory.bulk_opening_stock_recorded',
    'inventory_balances',
    jsonb_build_object(
      'branch_id', p_branch_id,
      'item_count', v_count,
      'reference_id', 'opening_stocktake'
    )
  );

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_record_opening_stock(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_record_opening_stock(UUID, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.bulk_record_opening_stock(UUID, UUID, JSONB)
  IS 'TASK-UK-SUPER-005H: Bulk opening stocktake upsert for retail branch inventory balances and stock movement tracking.';
