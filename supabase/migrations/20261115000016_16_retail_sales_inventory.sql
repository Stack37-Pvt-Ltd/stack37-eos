-- Migration: TASK-UK-SUPER-004 retail inventory and cash-register operations
-- Purpose: branch stock balances, audited stock adjustments, atomic sales, and real dashboard totals.
-- Release note: apply only to the explicitly approved isolated database after review.

ALTER TABLE public.products
  ADD CONSTRAINT products_organization_id_id_key UNIQUE (organization_id, id);

INSERT INTO public.permissions (id, module_name, action)
VALUES ('pos_checkout', 'retail', 'checkout'), ('inventory_edit', 'inventory', 'edit')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Administrator' AND r.is_system = true
  AND p.id IN ('pos_checkout', 'inventory_edit')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Give future system Administrators the same retail permissions as existing ones.
CREATE OR REPLACE FUNCTION private.seed_retail_admin_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.name = 'Administrator' AND NEW.is_system THEN
    INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
    VALUES (NEW.organization_id, NEW.id, 'pos_checkout'), (NEW.organization_id, NEW.id, 'inventory_edit')
    ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.seed_retail_admin_permissions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER seed_retail_admin_permissions_after_insert
  AFTER INSERT ON public.roles FOR EACH ROW EXECUTE FUNCTION private.seed_retail_admin_permissions();

CREATE TABLE public.inventory_balances (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, branch_id, product_id),
  FOREIGN KEY (organization_id, branch_id) REFERENCES public.branches(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, product_id) REFERENCES public.products(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.retail_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  receipt_number TEXT NOT NULL,
  idempotency_key UUID NOT NULL,
  request_signature TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'external_card')),
  subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
  tax_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_total = 0),
  total NUMERIC(14, 2) NOT NULL CHECK (total = subtotal + tax_total),
  cashier_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retail_sales_org_branch_fk FOREIGN KEY (organization_id, branch_id)
    REFERENCES public.branches(organization_id, id),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, receipt_number),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE public.retail_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total = round(quantity * unit_price, 2)),
  CONSTRAINT retail_sale_items_org_sale_fk FOREIGN KEY (organization_id, sale_id)
    REFERENCES public.retail_sales(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT retail_sale_items_org_product_fk FOREIGN KEY (organization_id, product_id)
    REFERENCES public.products(organization_id, id),
  UNIQUE (sale_id, product_id)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, branch_id, product_id)
    REFERENCES public.inventory_balances(organization_id, branch_id, product_id),
  FOREIGN KEY (organization_id, sale_id)
    REFERENCES public.retail_sales(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX inventory_balances_org_branch_qty_idx
  ON public.inventory_balances(organization_id, branch_id, quantity);
CREATE INDEX retail_sales_org_branch_created_idx
  ON public.retail_sales(organization_id, branch_id, created_at DESC);
CREATE INDEX stock_movements_org_branch_created_idx
  ON public.stock_movements(organization_id, branch_id, created_at DESC);

ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inventory_balances, public.retail_sales, public.retail_sale_items, public.stock_movements
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_balances, public.retail_sales, public.retail_sale_items, public.stock_movements
  TO authenticated;

CREATE OR REPLACE FUNCTION private.has_branch_access(p_org_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.membership_branches mb
      ON mb.organization_id = om.organization_id AND mb.membership_id = om.id
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND mb.branch_id = p_branch_id
  );
$$;
REVOKE ALL ON FUNCTION private.has_branch_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_branch_access(UUID, UUID) TO authenticated;

CREATE POLICY "Assigned members read branch inventory" ON public.inventory_balances
  FOR SELECT TO authenticated USING (private.has_branch_access(organization_id, branch_id));
CREATE POLICY "Assigned members read retail sales" ON public.retail_sales
  FOR SELECT TO authenticated USING (private.has_branch_access(organization_id, branch_id));
CREATE POLICY "Assigned members read retail sale items" ON public.retail_sale_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.retail_sales s
      WHERE s.organization_id = retail_sale_items.organization_id
        AND s.id = retail_sale_items.sale_id
        AND private.has_branch_access(s.organization_id, s.branch_id)
    )
  );
CREATE POLICY "Assigned members read stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (private.has_branch_access(organization_id, branch_id));

-- Existing products and branches start at zero. The source export did not contain reliable opening quantities.
INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
SELECT b.organization_id, b.id, p.id, 0
FROM public.branches b
JOIN public.products p ON p.organization_id = b.organization_id
ON CONFLICT (organization_id, branch_id, product_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.initialize_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
  SELECT NEW.organization_id, b.id, NEW.id, 0
  FROM public.branches b WHERE b.organization_id = NEW.organization_id
  ON CONFLICT (organization_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.initialize_product_stock() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_product_stock_after_insert
  AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION private.initialize_product_stock();

CREATE OR REPLACE FUNCTION private.initialize_branch_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
  SELECT NEW.organization_id, NEW.id, p.id, 0
  FROM public.products p WHERE p.organization_id = NEW.organization_id
  ON CONFLICT (organization_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.initialize_branch_stock() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_branch_stock_after_insert
  AFTER INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION private.initialize_branch_stock();

-- Add a non-system Cashier role to current and future workspaces; its only permission is checkout.
INSERT INTO public.roles (organization_id, name, is_system)
SELECT o.id, 'Cashier', false FROM public.organizations o
ON CONFLICT (organization_id, name) DO NOTHING;
INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, 'pos_checkout'
FROM public.roles r WHERE r.name = 'Cashier'
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.seed_cashier_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role_id UUID;
BEGIN
  INSERT INTO public.roles (organization_id, name, is_system)
  VALUES (NEW.id, 'Cashier', false)
  ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_role_id;
  INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
  VALUES (NEW.id, v_role_id, 'pos_checkout')
  ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.seed_cashier_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER seed_cashier_role_after_org_insert
  AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION private.seed_cashier_role();

CREATE SEQUENCE public.retail_receipt_number_seq;
REVOKE ALL ON SEQUENCE public.retail_receipt_number_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_organization_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity_delta NUMERIC,
  p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID := auth.uid(); v_is_owner BOOLEAN; v_quantity NUMERIC(14,3);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 OR abs(p_quantity_delta) > 1000000 OR p_quantity_delta <> trunc(p_quantity_delta, 3) THEN
    RAISE EXCEPTION 'Enter a non-zero stock adjustment within the supported range.';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 300 THEN
    RAISE EXCEPTION 'A stock adjustment reason between 3 and 300 characters is required.';
  END IF;
  SELECT om.is_owner INTO v_is_owner
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = v_user_id AND om.status = 'active';
  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_permission(p_organization_id, 'inventory_edit') THEN
    RAISE EXCEPTION 'You do not have permission to adjust stock.';
  END IF;
  IF NOT private.has_branch_access(p_organization_id, p_branch_id) THEN
    RAISE EXCEPTION 'You are not assigned to this operating branch.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.organization_id = p_organization_id AND p.id = p_product_id AND p.is_active) THEN
    RAISE EXCEPTION 'The selected product is unavailable in this organization.';
  END IF;
  INSERT INTO public.inventory_balances (organization_id, branch_id, product_id, quantity)
  VALUES (p_organization_id, p_branch_id, p_product_id, 0)
  ON CONFLICT (organization_id, branch_id, product_id) DO NOTHING;
  UPDATE public.inventory_balances
  SET quantity = quantity + p_quantity_delta, updated_at = now()
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND product_id = p_product_id
    AND quantity + p_quantity_delta >= 0
  RETURNING quantity INTO v_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'The adjustment would make stock negative.'; END IF;
  INSERT INTO public.stock_movements (organization_id, branch_id, product_id, movement_type, quantity_delta, reason, actor_user_id)
  VALUES (p_organization_id, p_branch_id, p_product_id, 'adjustment', p_quantity_delta, trim(p_reason), v_user_id);
  PERFORM private.insert_audit_log(p_organization_id, 'inventory.stock_adjusted', 'inventory_balances',
    jsonb_build_object('branch_id', p_branch_id, 'product_id', p_product_id, 'quantity_delta', p_quantity_delta, 'quantity_after', v_quantity, 'reason', trim(p_reason)));
  RETURN jsonb_build_object('quantity', v_quantity);
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_inventory(UUID, UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_retail_sale(
  p_organization_id UUID,
  p_branch_id UUID,
  p_idempotency_key UUID,
  p_payment_method TEXT,
  p_lines JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_is_owner BOOLEAN; v_sale_id UUID; v_receipt TEXT;
  v_subtotal NUMERIC(14,2) := 0; v_line JSONB; v_product_id UUID; v_qty NUMERIC(14,3);
  v_unit_price NUMERIC(14,2); v_product_name TEXT; v_sku TEXT; v_stock NUMERIC(14,3);
  v_item_count INTEGER := 0; v_created_at TIMESTAMPTZ; v_existing JSONB; v_signature TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'A checkout request key is required.'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'external_card') THEN RAISE EXCEPTION 'Choose cash or externally processed card payment.'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 100 THEN
    RAISE EXCEPTION 'A sale must contain between 1 and 100 product lines.';
  END IF;
  SELECT om.is_owner INTO v_is_owner
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = v_user_id AND om.status = 'active';
  IF v_is_owner IS NULL THEN RAISE EXCEPTION 'Active organization membership is required.'; END IF;
  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_permission(p_organization_id, 'pos_checkout') THEN
    RAISE EXCEPTION 'Your assigned role cannot operate checkout.';
  END IF;
  IF NOT private.has_branch_access(p_organization_id, p_branch_id) THEN
    RAISE EXCEPTION 'You are not assigned to this operating branch.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::TEXT || ':' || p_idempotency_key::TEXT, 0));
  SELECT md5(p_branch_id::TEXT || ':' || p_payment_method || ':' || COALESCE(jsonb_agg(jsonb_build_object('product_id', q.product_id, 'quantity', q.quantity) ORDER BY q.product_id)::TEXT, '[]'))
  INTO v_signature
  FROM (
    SELECT (x.value->>'product_id')::UUID AS product_id, sum((x.value->>'quantity')::NUMERIC) AS quantity
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID
  ) q;
  SELECT jsonb_build_object('saleId', s.id, 'receiptNumber', s.receipt_number, 'subtotal', s.subtotal,
    'taxTotal', s.tax_total, 'total', s.total, 'paymentMethod', s.payment_method, 'createdAt', s.created_at,
    'itemCount', (SELECT count(*) FROM public.retail_sale_items i WHERE i.sale_id = s.id), 'requestSignature', s.request_signature)
  INTO v_existing FROM public.retail_sales s
  WHERE s.organization_id = p_organization_id AND s.idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing->>'requestSignature' IS DISTINCT FROM v_signature THEN RAISE EXCEPTION 'This checkout key was already used for a different sale.'; END IF;
    RETURN (v_existing - 'requestSignature') || jsonb_build_object('replayed', true);
  END IF;

  -- Coalesce duplicate basket lines and validate/lock balances before writing any sale rows.
  FOR v_line IN
    SELECT jsonb_build_object('product_id', (x.value->>'product_id')::UUID, 'quantity', sum((x.value->>'quantity')::NUMERIC))
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID
    ORDER BY (x.value->>'product_id')::UUID
  LOOP
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty := (v_line->>'quantity')::NUMERIC;
    IF v_qty <= 0 OR v_qty > 100000 OR v_qty <> trunc(v_qty, 3) THEN RAISE EXCEPTION 'Product quantities must be positive, have at most 3 decimal places and stay within the supported range.'; END IF;
    SELECT p.name, p.sku, p.selling_price INTO v_product_name, v_sku, v_unit_price
    FROM public.products p WHERE p.organization_id = p_organization_id AND p.id = v_product_id AND p.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in this basket is no longer available.'; END IF;
    SELECT b.quantity INTO v_stock FROM public.inventory_balances b
    WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id AND b.product_id = v_product_id
    FOR UPDATE;
    IF NOT FOUND OR v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for %.', v_product_name; END IF;
    v_subtotal := v_subtotal + round(v_unit_price * v_qty, 2);
    v_item_count := v_item_count + 1;
  END LOOP;

  v_receipt := 'UKS-' || to_char(now() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD') || '-' || lpad(nextval('public.retail_receipt_number_seq')::TEXT, 7, '0');
  INSERT INTO public.retail_sales (organization_id, branch_id, receipt_number, idempotency_key, request_signature, payment_method, subtotal, tax_total, total, cashier_user_id)
  VALUES (p_organization_id, p_branch_id, v_receipt, p_idempotency_key, v_signature, p_payment_method, v_subtotal, 0, v_subtotal, v_user_id)
  RETURNING id, created_at INTO v_sale_id, v_created_at;

  FOR v_line IN
    SELECT jsonb_build_object('product_id', (x.value->>'product_id')::UUID, 'quantity', sum((x.value->>'quantity')::NUMERIC))
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID
    ORDER BY (x.value->>'product_id')::UUID
  LOOP
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty := (v_line->>'quantity')::NUMERIC;
    SELECT p.name, p.sku, p.selling_price INTO v_product_name, v_sku, v_unit_price
    FROM public.products p WHERE p.organization_id = p_organization_id AND p.id = v_product_id AND p.is_active;
    UPDATE public.inventory_balances SET quantity = quantity - v_qty, updated_at = now()
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND product_id = v_product_id AND quantity >= v_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed during checkout. Refresh the basket and try again.'; END IF;
    INSERT INTO public.retail_sale_items (organization_id, sale_id, product_id, product_name, sku, quantity, unit_price, line_total)
    VALUES (p_organization_id, v_sale_id, v_product_id, v_product_name, v_sku, v_qty, v_unit_price, round(v_unit_price * v_qty, 2));
    INSERT INTO public.stock_movements (organization_id, branch_id, product_id, sale_id, movement_type, quantity_delta, reason, actor_user_id)
    VALUES (p_organization_id, p_branch_id, v_product_id, v_sale_id, 'sale', -v_qty, 'Retail sale ' || v_receipt, v_user_id);
  END LOOP;

  PERFORM private.insert_audit_log(p_organization_id, 'retail.sale_completed', 'retail_sales',
    jsonb_build_object('sale_id', v_sale_id, 'receipt_number', v_receipt, 'branch_id', p_branch_id, 'total', v_subtotal, 'payment_method', p_payment_method));
  RETURN jsonb_build_object('saleId', v_sale_id, 'receiptNumber', v_receipt, 'itemCount', v_item_count,
    'subtotal', v_subtotal, 'taxTotal', 0, 'total', v_subtotal, 'paymentMethod', p_payment_method,
    'createdAt', v_created_at, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.record_retail_sale(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_retail_sale(UUID, UUID, UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_staff_assignment(
  p_organization_id UUID,
  p_membership_id UUID,
  p_role_id UUID,
  p_branch_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_target public.organization_members%ROWTYPE; v_user_id UUID := auth.uid(); v_is_owner BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT om.is_owner INTO v_is_owner FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = v_user_id AND om.status = 'active';
  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_permission(p_organization_id, 'manage_team') THEN
    RAISE EXCEPTION 'You do not have permission to manage team assignments.';
  END IF;
  SELECT * INTO v_target FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.id = p_membership_id AND om.status = 'active'
  FOR UPDATE;
  IF NOT FOUND OR v_target.is_owner THEN RAISE EXCEPTION 'That employee cannot be reassigned.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.organization_id = p_organization_id AND r.id = p_role_id)
    OR NOT private.can_assign_role(p_organization_id, p_role_id) THEN
    RAISE EXCEPTION 'You cannot assign that role.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.organization_id = p_organization_id AND b.id = p_branch_id) THEN
    RAISE EXCEPTION 'Choose a branch in this workspace.';
  END IF;
  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_branch_access(p_organization_id, p_branch_id) THEN
    RAISE EXCEPTION 'You cannot assign employees to a branch outside your own access.';
  END IF;
  DELETE FROM public.membership_roles WHERE organization_id = p_organization_id AND membership_id = p_membership_id;
  INSERT INTO public.membership_roles (organization_id, membership_id, role_id) VALUES (p_organization_id, p_membership_id, p_role_id);
  DELETE FROM public.membership_branches WHERE organization_id = p_organization_id AND membership_id = p_membership_id;
  INSERT INTO public.membership_branches (organization_id, membership_id, branch_id) VALUES (p_organization_id, p_membership_id, p_branch_id);
  PERFORM private.insert_audit_log(p_organization_id, 'team.assignment_updated', 'organization_members',
    jsonb_build_object('membership_id', p_membership_id, 'role_id', p_role_id, 'branch_id', p_branch_id));
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.update_staff_assignment(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_assignment(UUID, UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_retail_dashboard(p_organization_id UUID, p_branch_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_branch_access(p_organization_id, p_branch_id) THEN
    RAISE EXCEPTION 'You are not assigned to this operating branch.';
  END IF;
  SELECT jsonb_build_object(
    'salesToday', COALESCE((SELECT count(*) FROM public.retail_sales s WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE), 0),
    'grossSalesToday', COALESCE((SELECT sum(s.total) FROM public.retail_sales s WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE), 0),
    'itemsSoldToday', COALESCE((SELECT sum(i.quantity) FROM public.retail_sale_items i JOIN public.retail_sales s ON s.id = i.sale_id AND s.organization_id = i.organization_id WHERE s.organization_id = p_organization_id AND s.branch_id = p_branch_id AND (s.created_at AT TIME ZONE 'Asia/Colombo')::DATE = (now() AT TIME ZONE 'Asia/Colombo')::DATE), 0),
    'activeProducts', (SELECT count(*) FROM public.products p WHERE p.organization_id = p_organization_id AND p.is_active),
    'lowStockProducts', (SELECT count(*) FROM public.inventory_balances b JOIN public.products p ON p.organization_id = b.organization_id AND p.id = b.product_id WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id AND p.is_active AND b.quantity <= 5),
    'pendingDraftReviews', (SELECT count(*) FROM public.product_drafts d WHERE d.organization_id = p_organization_id AND d.status IN ('staged', 'reviewed')),
    'branchId', p_branch_id,
    'currency', COALESCE((SELECT o.currency FROM public.organizations o WHERE o.id = p_organization_id), 'LKR'),
    'asOf', now()
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_retail_dashboard(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_retail_dashboard(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.inventory_balances IS 'TASK-UK-SUPER-004: branch-level on-hand quantities; imported products start at zero until physically counted.';
COMMENT ON TABLE public.stock_movements IS 'TASK-UK-SUPER-004: append-only stock history for adjustments and retail sales.';
COMMENT ON TABLE public.retail_sales IS 'TASK-UK-SUPER-004: completed retail receipts; tax calculation and card processing are outside this task.';
