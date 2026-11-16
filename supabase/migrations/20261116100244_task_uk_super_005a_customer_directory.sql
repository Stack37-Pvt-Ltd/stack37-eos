-- TASK-UK-SUPER-005A: tenant-scoped customer directory and atomic POS association.
-- Local migration artifact only. Do not apply to a hosted database without CEO authorization.

INSERT INTO public.permissions (id, module_name, action)
VALUES
  ('customers_read', 'retail', 'read'),
  ('customers_manage', 'retail', 'manage')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX customers_org_name_idx ON public.customers (organization_id, lower(name), id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.customers TO authenticated;

CREATE POLICY "Authorized members read tenant customers" ON public.customers
  FOR SELECT TO authenticated
  USING (
    private.has_permission(organization_id, 'customers_read')
    OR private.has_permission(organization_id, 'customers_manage')
  );

-- Give existing and future system Administrators the customer permissions.
INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Administrator' AND r.is_system = true
  AND p.id IN ('customers_read', 'customers_manage')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.seed_retail_admin_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.name = 'Administrator' AND NEW.is_system THEN
    INSERT INTO public.role_permissions (organization_id, role_id, permission_id)
    VALUES
      (NEW.organization_id, NEW.id, 'pos_checkout'),
      (NEW.organization_id, NEW.id, 'inventory_edit'),
      (NEW.organization_id, NEW.id, 'customers_read'),
      (NEW.organization_id, NEW.id, 'customers_manage')
    ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.seed_retail_admin_permissions() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_retail_customer(
  p_organization_id UUID,
  p_customer_id UUID,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_name TEXT := trim(COALESCE(p_name, ''));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF length(v_name) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Customer name must be between 1 and 160 characters.'; END IF;
  IF NOT private.has_permission(p_organization_id, 'customers_manage') THEN
    RAISE EXCEPTION 'You do not have permission to manage customers.';
  END IF;

  IF p_customer_id IS NULL THEN
    INSERT INTO public.customers (organization_id, name, created_by)
    VALUES (p_organization_id, v_name, v_user_id)
    RETURNING * INTO v_customer;
    PERFORM private.insert_audit_log(p_organization_id, 'retail.customer_created', 'customers',
      jsonb_build_object('customer_id', v_customer.id));
  ELSE
    UPDATE public.customers c
    SET name = v_name, updated_at = now()
    WHERE c.organization_id = p_organization_id AND c.id = p_customer_id
    RETURNING c.* INTO v_customer;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found in this workspace.'; END IF;
    PERFORM private.insert_audit_log(p_organization_id, 'retail.customer_updated', 'customers',
      jsonb_build_object('customer_id', v_customer.id));
  END IF;

  RETURN jsonb_build_object('id', v_customer.id, 'name', v_customer.name,
    'createdAt', v_customer.created_at, 'updatedAt', v_customer.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_retail_customer(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_retail_customer(UUID, UUID, TEXT) TO authenticated;

ALTER TABLE public.retail_sales
  ADD COLUMN customer_id UUID,
  ADD COLUMN customer_request_signature TEXT;

ALTER TABLE public.retail_sales
  ADD CONSTRAINT retail_sales_org_customer_fk
    FOREIGN KEY (organization_id, customer_id)
    REFERENCES public.customers (organization_id, id) ON DELETE RESTRICT;

CREATE INDEX retail_sales_org_customer_created_idx
  ON public.retail_sales (organization_id, customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_retail_sale_with_customer(
  p_organization_id UUID,
  p_branch_id UUID,
  p_idempotency_key UUID,
  p_payment_method TEXT,
  p_lines JSONB,
  p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_result JSONB;
  v_sale_id UUID;
  v_replayed BOOLEAN;
  v_customer_id UUID;
  v_link_signature TEXT := md5(COALESCE(p_customer_id::TEXT, '<no-customer>'));
  v_existing_signature TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_customer_id IS NOT NULL
     AND NOT private.has_permission(p_organization_id, 'customers_read')
     AND NOT private.has_permission(p_organization_id, 'customers_manage') THEN
    RAISE EXCEPTION 'You do not have permission to attach a customer to this sale.';
  END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.organization_id = p_organization_id AND c.id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'The selected customer is unavailable in this workspace.';
  END IF;

  -- The underlying checkout validates membership, permission, branch, stock,
  -- and basket data. Both operations run in this transaction; association
  -- failure rolls the sale and stock changes back with it.
  v_result := public.record_retail_sale(
    p_organization_id, p_branch_id, p_idempotency_key, p_payment_method, p_lines
  );
  v_sale_id := (v_result->>'saleId')::UUID;
  v_replayed := COALESCE((v_result->>'replayed')::BOOLEAN, false);

  SELECT s.customer_id, s.customer_request_signature
  INTO v_customer_id, v_existing_signature
  FROM public.retail_sales s
  WHERE s.organization_id = p_organization_id AND s.id = v_sale_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The completed sale could not be linked to its receipt.'; END IF;

  IF v_replayed THEN
    IF v_existing_signature IS DISTINCT FROM v_link_signature THEN
      RAISE EXCEPTION 'This checkout key was already used with a different customer selection.';
    END IF;
  ELSE
    UPDATE public.retail_sales
    SET customer_id = p_customer_id,
        customer_request_signature = v_link_signature
    WHERE organization_id = p_organization_id AND id = v_sale_id;
    IF p_customer_id IS NOT NULL THEN
      PERFORM private.insert_audit_log(p_organization_id, 'retail.sale_customer_linked', 'retail_sales',
        jsonb_build_object('sale_id', v_sale_id, 'customer_id', p_customer_id));
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('customerId', p_customer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_retail_sale_with_customer(UUID, UUID, UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_retail_sale_with_customer(UUID, UUID, UUID, TEXT, JSONB, UUID) TO authenticated;
