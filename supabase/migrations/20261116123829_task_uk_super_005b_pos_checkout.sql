-- TASK-UK-SUPER-005B: atomic barcode POS checkout, split tenders, discounts, and printed receipt data.
-- CEO authorized application to shared Supabase Preview database on 2026-11-16.

ALTER TABLE public.customers
  ADD COLUMN phone TEXT,
  ADD CONSTRAINT customers_phone_normalized_check CHECK (
    phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$'
  );

ALTER TABLE public.organizations
  ADD COLUMN uber_commission_rate NUMERIC(5,2),
  ADD COLUMN pickme_commission_rate NUMERIC(5,2),
  ADD CONSTRAINT organizations_uber_commission_rate_check CHECK (uber_commission_rate IS NULL OR uber_commission_rate BETWEEN 0 AND 100),
  ADD CONSTRAINT organizations_pickme_commission_rate_check CHECK (pickme_commission_rate IS NULL OR pickme_commission_rate BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.update_retail_commission_rates(
  p_organization_id UUID,
  p_uber_commission_rate NUMERIC,
  p_pickme_commission_rate NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF (p_uber_commission_rate IS NOT NULL AND (p_uber_commission_rate < 0 OR p_uber_commission_rate > 100 OR p_uber_commission_rate <> trunc(p_uber_commission_rate, 2)))
    OR (p_pickme_commission_rate IS NOT NULL AND (p_pickme_commission_rate < 0 OR p_pickme_commission_rate > 100 OR p_pickme_commission_rate <> trunc(p_pickme_commission_rate, 2))) THEN
    RAISE EXCEPTION 'Provider commission rates must be from 0 to 100 percent with up to 2 decimal places.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_organization_id AND om.user_id = v_user_id AND om.status = 'active' AND om.is_owner
  ) THEN RAISE EXCEPTION 'Only the active Primary Owner can change provider rates.'; END IF;

  UPDATE public.organizations
  SET uber_commission_rate = p_uber_commission_rate,
      pickme_commission_rate = p_pickme_commission_rate
  WHERE id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace not found.'; END IF;
  PERFORM private.insert_audit_log(p_organization_id, 'retail.provider_rates_updated', 'organizations',
    jsonb_build_object('uber_commission_rate', p_uber_commission_rate, 'pickme_commission_rate', p_pickme_commission_rate));
  RETURN jsonb_build_object('saved', true);
END;
$$;
REVOKE ALL ON FUNCTION public.update_retail_commission_rates(UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_retail_commission_rates(UUID, NUMERIC, NUMERIC) TO authenticated;

CREATE UNIQUE INDEX customers_org_phone_unique_idx
  ON public.customers (organization_id, phone)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_retail_customer(
  p_organization_id UUID,
  p_customer_id UUID,
  p_name TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_phone TEXT := regexp_replace(trim(COALESCE(p_phone, '')), '[[:space:]().-]', '', 'g');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF length(v_name) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Customer name must be between 1 and 160 characters.'; END IF;
  IF v_phone !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'Enter a valid customer phone number.'; END IF;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET name = v_name, phone = v_phone, updated_at = now()
    WHERE c.organization_id = p_organization_id AND c.id = p_customer_id
    RETURNING c.* INTO v_customer;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found in this workspace.'; END IF;
  ELSE
    INSERT INTO public.customers (organization_id, name, phone, created_by)
    VALUES (p_organization_id, v_name, v_phone, v_user_id)
    ON CONFLICT (organization_id, phone) WHERE phone IS NOT NULL
    DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING * INTO v_customer;
  END IF;

  PERFORM private.insert_audit_log(p_organization_id,
    CASE WHEN p_customer_id IS NULL THEN 'retail.customer_created_or_matched' ELSE 'retail.customer_updated' END,
    'customers', jsonb_build_object('customer_id', v_customer.id));
  RETURN jsonb_build_object('id', v_customer.id, 'name', v_customer.name, 'phone', v_customer.phone,
    'createdAt', v_customer.created_at, 'updatedAt', v_customer.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_retail_customer(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_retail_customer(UUID, UUID, TEXT, TEXT) TO authenticated;

ALTER TABLE public.retail_sales
  ADD COLUMN discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 20),
  ADD COLUMN discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

DO $$
DECLARE v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.retail_sales'::regclass AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%subtotal%'
      AND pg_get_constraintdef(c.oid) LIKE '%tax_total%'
      AND pg_get_constraintdef(c.oid) LIKE '%total%'
  LOOP
    EXECUTE format('ALTER TABLE public.retail_sales DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END;
$$;
ALTER TABLE public.retail_sales ADD CONSTRAINT retail_sales_total_discount_check
  CHECK (total = subtotal - discount_amount + tax_total);
DO $$
DECLARE v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.retail_sales'::regclass AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%payment_method%'
      AND pg_get_constraintdef(c.oid) LIKE '%external_card%'
  LOOP
    EXECUTE format('ALTER TABLE public.retail_sales DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END;
$$;
ALTER TABLE public.retail_sales ADD CONSTRAINT retail_sales_payment_method_check
  CHECK (payment_method IN ('cash', 'external_card', 'uber', 'pickme', 'mixed'));

CREATE TABLE public.retail_sale_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'uber', 'pickme')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  FOREIGN KEY (organization_id, sale_id)
    REFERENCES public.retail_sales (organization_id, id) ON DELETE CASCADE,
  UNIQUE (sale_id, payment_method)
);
CREATE INDEX retail_sale_tenders_org_sale_idx ON public.retail_sale_tenders (organization_id, sale_id);
ALTER TABLE public.retail_sale_tenders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retail_sale_tenders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.retail_sale_tenders TO authenticated;
CREATE POLICY "Assigned members read retail sale tenders" ON public.retail_sale_tenders
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.retail_sales s
      WHERE s.organization_id = retail_sale_tenders.organization_id
        AND s.id = retail_sale_tenders.sale_id
        AND private.has_branch_access(s.organization_id, s.branch_id)
    )
  );

CREATE TABLE public.retail_sale_provider_settlements (
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('uber', 'pickme')),
  commission_rate NUMERIC(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
  gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
  commission_amount NUMERIC(14,2) NOT NULL CHECK (commission_amount >= 0 AND commission_amount <= gross_amount),
  net_settlement NUMERIC(14,2) NOT NULL CHECK (net_settlement = gross_amount - commission_amount),
  PRIMARY KEY (sale_id, provider),
  FOREIGN KEY (organization_id, sale_id)
    REFERENCES public.retail_sales (organization_id, id) ON DELETE CASCADE
);
ALTER TABLE public.retail_sale_provider_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retail_sale_provider_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.retail_sale_provider_settlements TO authenticated;
CREATE POLICY "Assigned members read provider settlements" ON public.retail_sale_provider_settlements
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.retail_sales s
      WHERE s.organization_id = retail_sale_provider_settlements.organization_id
        AND s.id = retail_sale_provider_settlements.sale_id
        AND private.has_branch_access(s.organization_id, s.branch_id)
    )
  );

CREATE OR REPLACE FUNCTION public.complete_retail_checkout(
  p_organization_id UUID,
  p_branch_id UUID,
  p_idempotency_key UUID,
  p_discount_percent NUMERIC,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_tenders JSONB,
  p_lines JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owner BOOLEAN;
  v_sale_id UUID;
  v_receipt TEXT;
  v_customer_id UUID;
  v_customer_name TEXT := NULLIF(trim(COALESCE(p_customer_name, '')), '');
  v_customer_phone TEXT := NULLIF(regexp_replace(trim(COALESCE(p_customer_phone, '')), '[[:space:]().-]', '', 'g'), '');
  v_discount_percent NUMERIC(5,2) := p_discount_percent;
  v_subtotal NUMERIC(14,2) := 0;
  v_discount_amount NUMERIC(14,2);
  v_total NUMERIC(14,2);
  v_tender_total NUMERIC(14,2) := 0;
  v_payment_method TEXT;
  v_uber_rate NUMERIC(5,2);
  v_pickme_rate NUMERIC(5,2);
  v_method TEXT;
  v_amount NUMERIC(14,2);
  v_line JSONB;
  v_product_id UUID;
  v_qty NUMERIC(14,3);
  v_unit_price NUMERIC(14,2);
  v_product_name TEXT;
  v_sku TEXT;
  v_stock NUMERIC(14,3);
  v_item_count INTEGER := 0;
  v_created_at TIMESTAMPTZ;
  v_existing JSONB;
  v_signature TEXT;
  v_canonical_lines JSONB;
  v_canonical_tenders JSONB;
  v_receipt_lines JSONB;
  v_receipt_tenders JSONB;
  v_receipt_settlements JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'A checkout request key is required.'; END IF;
  IF p_discount_percent IS NULL OR p_discount_percent < 0 OR p_discount_percent > 20 OR p_discount_percent <> trunc(p_discount_percent, 2) THEN
    RAISE EXCEPTION 'Cashier discount must be between 0 and 20 percent.';
  END IF;
  IF (v_customer_name IS NULL) <> (v_customer_phone IS NULL) THEN RAISE EXCEPTION 'Enter both customer name and phone, or leave both blank.'; END IF;
  IF v_customer_name IS NOT NULL AND length(v_customer_name) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Customer name must be between 1 and 160 characters.'; END IF;
  IF v_customer_phone IS NOT NULL AND v_customer_phone !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'Enter a valid customer phone number.'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 100 THEN
    RAISE EXCEPTION 'A sale must contain between 1 and 100 product lines.';
  END IF;
  IF p_tenders IS NULL OR jsonb_typeof(p_tenders) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tenders) < 1 OR jsonb_array_length(p_tenders) > 4 THEN
    RAISE EXCEPTION 'Choose one or more payment methods.';
  END IF;

  SELECT om.is_owner INTO v_is_owner
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = v_user_id AND om.status = 'active';
  IF v_is_owner IS NULL THEN RAISE EXCEPTION 'Active organization membership is required.'; END IF;
  IF v_is_owner IS DISTINCT FROM true AND NOT private.has_permission(p_organization_id, 'pos_checkout') THEN
    RAISE EXCEPTION 'Your assigned role cannot operate checkout.';
  END IF;
  IF NOT private.has_branch_access(p_organization_id, p_branch_id) THEN RAISE EXCEPTION 'You are not assigned to this operating branch.'; END IF;

  SELECT o.uber_commission_rate, o.pickme_commission_rate INTO v_uber_rate, v_pickme_rate
  FROM public.organizations o WHERE o.id = p_organization_id FOR SHARE;

  SELECT jsonb_agg(jsonb_build_object('product_id', q.product_id, 'quantity', q.quantity) ORDER BY q.product_id)
  INTO v_canonical_lines
  FROM (
    SELECT (x.value->>'product_id')::UUID AS product_id, sum((x.value->>'quantity')::NUMERIC) AS quantity
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID
  ) q;
  SELECT jsonb_agg(jsonb_build_object('method', q.method, 'amount', q.amount) ORDER BY q.method)
  INTO v_canonical_tenders
  FROM (
    SELECT x.value->>'method' AS method, sum((x.value->>'amount')::NUMERIC) AS amount
    FROM jsonb_array_elements(p_tenders) x(value)
    GROUP BY x.value->>'method'
  ) q;
  IF jsonb_array_length(v_canonical_tenders) <> jsonb_array_length(p_tenders) THEN RAISE EXCEPTION 'Use each payment method once.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tenders) x(value)
    WHERE x.value->>'method' IS NULL
      OR x.value->>'method' NOT IN ('cash', 'card', 'uber', 'pickme')
      OR (x.value->>'amount') IS NULL
      OR (x.value->>'amount')::NUMERIC <= 0
      OR (x.value->>'amount')::NUMERIC <> round((x.value->>'amount')::NUMERIC, 2)) THEN
    RAISE EXCEPTION 'Payment methods or amounts are invalid.';
  END IF;
  v_signature := md5(jsonb_build_object('branch_id', p_branch_id, 'discount_percent', v_discount_percent,
    'customer_name', v_customer_name, 'customer_phone', v_customer_phone,
    'tenders', v_canonical_tenders, 'lines', COALESCE(v_canonical_lines, '[]'::JSONB))::TEXT);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::TEXT || ':' || p_idempotency_key::TEXT, 0));
  SELECT jsonb_build_object('saleId', s.id, 'receiptNumber', s.receipt_number, 'subtotal', s.subtotal,
    'discountPercent', s.discount_percent, 'discountAmount', s.discount_amount, 'taxTotal', s.tax_total,
    'total', s.total, 'paymentMethod', s.payment_method, 'createdAt', s.created_at,
    'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone) END,
    'itemCount', (SELECT count(*) FROM public.retail_sale_items i WHERE i.sale_id = s.id),
    'lines', (SELECT jsonb_agg(jsonb_build_object('productId', i.product_id, 'name', i.product_name,
      'sku', i.sku, 'quantity', i.quantity, 'unitPrice', i.unit_price, 'lineTotal', i.line_total) ORDER BY i.product_name)
      FROM public.retail_sale_items i WHERE i.sale_id = s.id),
    'tenders', (SELECT jsonb_agg(jsonb_build_object('method', t.payment_method, 'amount', t.amount) ORDER BY t.payment_method)
      FROM public.retail_sale_tenders t WHERE t.sale_id = s.id),
    'providerSettlements', COALESCE((SELECT jsonb_agg(jsonb_build_object('provider', ps.provider, 'commissionRate', ps.commission_rate,
      'grossAmount', ps.gross_amount, 'commissionAmount', ps.commission_amount, 'netSettlement', ps.net_settlement) ORDER BY ps.provider)
      FROM public.retail_sale_provider_settlements ps WHERE ps.sale_id = s.id), '[]'::JSONB), 'requestSignature', s.request_signature)
  INTO v_existing
  FROM public.retail_sales s LEFT JOIN public.customers c ON c.organization_id = s.organization_id AND c.id = s.customer_id
  WHERE s.organization_id = p_organization_id AND s.idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing->>'requestSignature' IS DISTINCT FROM v_signature THEN RAISE EXCEPTION 'This checkout key was already used for a different sale.'; END IF;
    RETURN (v_existing - 'requestSignature') || jsonb_build_object('replayed', true);
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tenders) x(value) WHERE x.value->>'method' = 'uber') AND v_uber_rate IS NULL THEN
    RAISE EXCEPTION 'Set the Uber commission percentage in Settings before recording Uber orders.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tenders) x(value) WHERE x.value->>'method' = 'pickme') AND v_pickme_rate IS NULL THEN
    RAISE EXCEPTION 'Set the PickMe commission percentage in Settings before recording PickMe orders.';
  END IF;

  FOR v_line IN
    SELECT jsonb_build_object('product_id', (x.value->>'product_id')::UUID, 'quantity', sum((x.value->>'quantity')::NUMERIC))
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID ORDER BY (x.value->>'product_id')::UUID
  LOOP
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty := (v_line->>'quantity')::NUMERIC;
    IF v_qty <= 0 OR v_qty > 100000 OR v_qty <> trunc(v_qty, 3) THEN RAISE EXCEPTION 'Product quantities must be positive, at most 3 decimal places and within range.'; END IF;
    SELECT p.name, p.sku, p.selling_price INTO v_product_name, v_sku, v_unit_price
    FROM public.products p WHERE p.organization_id = p_organization_id AND p.id = v_product_id AND p.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in this basket is no longer available.'; END IF;
    SELECT b.quantity INTO v_stock FROM public.inventory_balances b
    WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id AND b.product_id = v_product_id FOR UPDATE;
    IF NOT FOUND OR v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for %.', v_product_name; END IF;
    v_subtotal := v_subtotal + round(v_unit_price * v_qty, 2);
    v_item_count := v_item_count + 1;
  END LOOP;
  v_discount_amount := round(v_subtotal * v_discount_percent / 100, 2);
  v_total := v_subtotal - v_discount_amount;
  SELECT sum((x.value->>'amount')::NUMERIC) INTO v_tender_total FROM jsonb_array_elements(p_tenders) x(value);
  IF v_tender_total <> v_total THEN RAISE EXCEPTION 'Tender amounts must exactly match the discounted sale total.'; END IF;
  -- Map the methods from the validated request before sale rows exist.
  SELECT CASE WHEN count(*) > 1 THEN 'mixed'
    WHEN min(x.value->>'method') = 'card' THEN 'external_card' ELSE min(x.value->>'method') END
  INTO v_payment_method FROM jsonb_array_elements(p_tenders) x(value);

  IF v_customer_name IS NOT NULL THEN
    INSERT INTO public.customers (organization_id, name, phone, created_by)
    VALUES (p_organization_id, v_customer_name, v_customer_phone, v_user_id)
    ON CONFLICT (organization_id, phone) WHERE phone IS NOT NULL
    DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id, name INTO v_customer_id, v_customer_name;
  END IF;

  v_receipt := 'UKS-' || to_char(now() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD') || '-' || lpad(nextval('public.retail_receipt_number_seq')::TEXT, 7, '0');
  INSERT INTO public.retail_sales (organization_id, branch_id, receipt_number, idempotency_key, request_signature,
    payment_method, subtotal, tax_total, total, discount_percent, discount_amount, cashier_user_id, customer_id, customer_request_signature)
  VALUES (p_organization_id, p_branch_id, v_receipt, p_idempotency_key, v_signature, v_payment_method,
    v_subtotal, 0, v_total, v_discount_percent, v_discount_amount, v_user_id, v_customer_id, v_signature)
  RETURNING id, created_at INTO v_sale_id, v_created_at;

  FOR v_line IN
    SELECT jsonb_build_object('product_id', (x.value->>'product_id')::UUID, 'quantity', sum((x.value->>'quantity')::NUMERIC))
    FROM jsonb_array_elements(p_lines) x(value)
    GROUP BY (x.value->>'product_id')::UUID ORDER BY (x.value->>'product_id')::UUID
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
  INSERT INTO public.retail_sale_tenders (organization_id, sale_id, payment_method, amount)
  SELECT p_organization_id, v_sale_id, x.value->>'method', (x.value->>'amount')::NUMERIC
  FROM jsonb_array_elements(p_tenders) x(value);
  INSERT INTO public.retail_sale_provider_settlements (organization_id, sale_id, provider, commission_rate, gross_amount, commission_amount, net_settlement)
  SELECT p_organization_id, v_sale_id, x.value->>'method',
    CASE x.value->>'method' WHEN 'uber' THEN v_uber_rate WHEN 'pickme' THEN v_pickme_rate END,
    (x.value->>'amount')::NUMERIC,
    round((x.value->>'amount')::NUMERIC * CASE x.value->>'method' WHEN 'uber' THEN v_uber_rate WHEN 'pickme' THEN v_pickme_rate END / 100, 2),
    (x.value->>'amount')::NUMERIC - round((x.value->>'amount')::NUMERIC * CASE x.value->>'method' WHEN 'uber' THEN v_uber_rate WHEN 'pickme' THEN v_pickme_rate END / 100, 2)
  FROM jsonb_array_elements(p_tenders) x(value)
  WHERE x.value->>'method' IN ('uber', 'pickme');

  PERFORM private.insert_audit_log(p_organization_id, 'retail.sale_completed', 'retail_sales',
    jsonb_build_object('sale_id', v_sale_id, 'receipt_number', v_receipt, 'branch_id', p_branch_id,
      'total', v_total, 'discount_percent', v_discount_percent, 'payment_method', v_payment_method,
      'item_count', v_item_count, 'tender_methods', (SELECT jsonb_agg(x.value->>'method') FROM jsonb_array_elements(p_tenders) x(value))));

  SELECT jsonb_agg(jsonb_build_object('productId', i.product_id, 'name', i.product_name, 'sku', i.sku,
    'quantity', i.quantity, 'unitPrice', i.unit_price, 'lineTotal', i.line_total) ORDER BY i.product_name)
  INTO v_receipt_lines FROM public.retail_sale_items i WHERE i.sale_id = v_sale_id;
  SELECT jsonb_agg(jsonb_build_object('method', t.payment_method, 'amount', t.amount) ORDER BY t.payment_method)
  INTO v_receipt_tenders FROM public.retail_sale_tenders t WHERE t.sale_id = v_sale_id;
  SELECT jsonb_agg(jsonb_build_object('provider', ps.provider, 'commissionRate', ps.commission_rate,
    'grossAmount', ps.gross_amount, 'commissionAmount', ps.commission_amount, 'netSettlement', ps.net_settlement) ORDER BY ps.provider)
  INTO v_receipt_settlements FROM public.retail_sale_provider_settlements ps WHERE ps.sale_id = v_sale_id;
  RETURN jsonb_build_object('saleId', v_sale_id, 'receiptNumber', v_receipt, 'itemCount', v_item_count,
    'subtotal', v_subtotal, 'discountPercent', v_discount_percent, 'discountAmount', v_discount_amount,
    'taxTotal', 0, 'total', v_total, 'paymentMethod', v_payment_method,
    'customer', CASE WHEN v_customer_id IS NULL THEN NULL ELSE jsonb_build_object('id', v_customer_id, 'name', v_customer_name, 'phone', v_customer_phone) END,
    'tenders', v_receipt_tenders, 'providerSettlements', COALESCE(v_receipt_settlements, '[]'::JSONB),
    'lines', v_receipt_lines, 'createdAt', v_created_at, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_retail_checkout(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_retail_checkout(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, JSONB, JSONB) TO authenticated;

COMMENT ON TABLE public.retail_sale_tenders IS 'TASK-UK-SUPER-005B: cashier-recorded tenders; no payment processor integration.';
