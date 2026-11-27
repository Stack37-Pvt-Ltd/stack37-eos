'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import {
  AdjustInventorySchema,
  BulkOpeningStockSchema,
  CompleteRetailCheckoutSchema,
  SearchRetailCustomersSchema,
  UpdateRetailCommissionRatesSchema,
  UpsertRetailCustomerSchema,
} from '../validations/retail';

export interface RetailActionResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function updateRetailCommissionRatesAction(rawInput: unknown): Promise<RetailActionResult<{ saved: true }>> {
  const parsed = UpdateRetailCommissionRatesSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check both provider percentages.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, uberCommissionRate, pickmeCommissionRate } = parsed.data;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'Authentication required. Please sign in.' };
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError || !membership || membership.status !== 'active' || !membership.is_owner) {
    return { success: false, error: 'Only the active Primary Owner can change provider rates.' };
  }
  const { error } = await supabase.rpc('update_retail_commission_rates', {
    p_organization_id: organizationId,
    p_uber_commission_rate: uberCommissionRate,
    p_pickme_commission_rate: pickmeCommissionRate,
  });
  if (error) return { success: false, error: 'Provider rates could not be saved. Refresh Settings and try again.' };
  const { data: organization } = await supabase.from('organizations').select('slug').eq('id', organizationId).maybeSingle();
  if (organization?.slug) {
    revalidatePath(`/tenant/${organization.slug}/settings`);
    revalidatePath(`/tenant/${organization.slug}/retail`);
    revalidatePath(`/w/${encodeURIComponent(organization.slug)}/settings`);
    revalidatePath(`/w/${encodeURIComponent(organization.slug)}/retail`);
  }
  return { success: true, data: { saved: true } };
}

function previewMutationBlocked(scope: 'customer' | 'sale' | 'inventory' = 'inventory'): RetailActionResult | null {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  // The CEO approved live Preview customer and POS writes for TASK-UK-SUPER-005A.
  // Stock adjustments remain blocked; POS sales continue to decrement stock atomically.
  return scope === 'customer' || scope === 'sale'
    ? null
    : { success: false, error: 'Inventory adjustments are disabled in Preview to protect shared live stock.' };
}

async function verifyActiveMember(organizationId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, error: 'Authentication required. Please sign in.' };
  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !membership || membership.status !== 'active') {
    return { supabase, error: 'Active workspace membership is required.' };
  }
  return { supabase, user, membership, error: undefined };
}

export async function recordRetailSaleAction(rawInput: unknown): Promise<RetailActionResult<{
  saleId: string;
  receiptNumber: string;
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  paymentMethod: 'cash' | 'external_card' | 'uber' | 'pickme' | 'mixed';
  customer: { id: string; name: string; phone: string } | null;
  tenders: Array<{ method: 'cash' | 'card' | 'uber' | 'pickme'; amount: number }>;
  providerSettlements: Array<{ provider: 'uber' | 'pickme'; commissionRate: number; grossAmount: number; commissionAmount: number; netSettlement: number }>;
  lines: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
  createdAt: string;
  replayed: boolean;
}>> {
  const previewBlock = previewMutationBlocked('sale');
  if (previewBlock) return { success: false, error: previewBlock.error };
  const parsed = CompleteRetailCheckoutSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check the basket, customer, discount and tender amounts.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, branchId, idempotencyKey, discountPercent, customer, tenders, lines } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  const { data, error } = await supabase.rpc('complete_retail_checkout', {
    p_organization_id: organizationId,
    p_branch_id: branchId,
    p_idempotency_key: idempotencyKey,
    p_discount_percent: discountPercent,
    p_customer_name: customer?.name || null,
    p_customer_phone: customer?.phone || null,
    p_tenders: tenders,
    p_lines: lines.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
  });
  if (error || !data) return { success: false, error: 'The sale could not be completed. Check the customer, payment amounts and stock, then try again.' };

  await revalidateRetailPaths(supabase, organizationId);
  return { success: true, data: data as RetailActionResult['data'] & {
    saleId: string; receiptNumber: string; itemCount: number; subtotal: number; discountPercent: number; discountAmount: number; taxTotal: number;
    total: number; paymentMethod: 'cash' | 'external_card' | 'uber' | 'pickme' | 'mixed';
    customer: { id: string; name: string; phone: string } | null;
    tenders: Array<{ method: 'cash' | 'card' | 'uber' | 'pickme'; amount: number }>;
    providerSettlements: Array<{ provider: 'uber' | 'pickme'; commissionRate: number; grossAmount: number; commissionAmount: number; netSettlement: number }>;
    lines: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
    createdAt: string; replayed: boolean;
  } };
}

export type RetailCustomer = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  lastPurchaseAt: string | null;
};

export async function searchRetailCustomersAction(rawInput: unknown): Promise<RetailActionResult<RetailCustomer[]>> {
  const parsed = SearchRetailCustomersSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check the customer search.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, query, limit } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  let request = supabase.from('customers')
    .select('id, name, phone, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })
    .limit(limit);
  if (query) request = request.ilike('name', `%${query}%`);
  const { data: nameMatches, error } = await request;
  if (error) return { success: false, error: 'Customer records could not be loaded.' };

  let data = nameMatches || [];
  if (query) {
    const { data: phoneMatches, error: phoneError } = await supabase.from('customers')
      .select('id, name, phone, created_at, updated_at')
      .eq('organization_id', organizationId)
      .ilike('phone', `%${query}%`)
      .order('name', { ascending: true })
      .limit(limit);
    if (phoneError) return { success: false, error: 'Customer records could not be loaded.' };
    const seen = new Set(data.map((customer) => customer.id));
    data = [...data, ...(phoneMatches || []).filter((customer) => !seen.has(customer.id))].slice(0, limit);
  }

  const customers = data.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
    lastPurchaseAt: null as string | null,
  }));
  if (customers.length) {
    const { data: sales } = await supabase.from('retail_sales')
      .select('customer_id, created_at')
      .eq('organization_id', organizationId)
      .in('customer_id', customers.map((customer) => customer.id))
      .order('created_at', { ascending: false })
      .limit(1000);
    const lastPurchase = new Map<string, string>();
    for (const sale of sales || []) {
      if (sale.customer_id && !lastPurchase.has(sale.customer_id)) lastPurchase.set(sale.customer_id, sale.created_at);
    }
    for (const customer of customers) customer.lastPurchaseAt = lastPurchase.get(customer.id) || null;
  }
  return { success: true, data: customers };
}

export async function upsertRetailCustomerAction(rawInput: unknown): Promise<RetailActionResult<RetailCustomer>> {
  const previewBlock = previewMutationBlocked('customer');
  if (previewBlock) return { success: false, error: previewBlock.error };
  const parsed = UpsertRetailCustomerSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check the customer name.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, customerId, name, phone } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  const { data, error } = await supabase.rpc('upsert_retail_customer', {
    p_organization_id: organizationId,
    p_customer_id: customerId || null,
    p_name: name,
    p_phone: phone,
  });
  if (error || !data) return { success: false, error: 'The customer could not be saved. Check your customer permissions and try again.' };
  await revalidateRetailPaths(supabase, organizationId);
  const saved = data as { id: string; name: string; phone: string; createdAt: string; updatedAt: string };
  return { success: true, data: { ...saved, lastPurchaseAt: null } };
}

export async function adjustInventoryAction(rawInput: unknown): Promise<RetailActionResult<{ quantity: number }>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return { success: false, error: previewBlock.error };
  const parsed = AdjustInventorySchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check the stock adjustment details.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, branchId, productId, quantityDelta, reason } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_organization_id: organizationId,
    p_branch_id: branchId,
    p_product_id: productId,
    p_quantity_delta: quantityDelta,
    p_reason: reason,
  });
  if (error || !data) return { success: false, error: error?.message || 'The stock adjustment could not be saved.' };
  await revalidateRetailPaths(supabase, organizationId);
  return { success: true, data: data as { quantity: number } };
}

export async function recordBulkOpeningStockAction(
  rawInput: unknown
): Promise<RetailActionResult<{ updatedCount: number }>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return { success: false, error: previewBlock.error };

  const parsed = BulkOpeningStockSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the stocktake items and quantities.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { organizationId, branchId, items } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  const payload = items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc('bulk_record_opening_stock', {
    p_organization_id: organizationId,
    p_branch_id: branchId,
    p_items: payload,
  });

  if (error || !data) {
    return {
      success: false,
      error: error?.message || 'The opening stocktake could not be saved.',
    };
  }

  const result = data as { success: boolean; updated_count: number };
  await revalidateRetailPaths(supabase, organizationId);

  return {
    success: true,
    data: { updatedCount: result.updated_count },
  };
}

async function revalidateRetailPaths(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data: organization } = await supabase.from('organizations').select('slug').eq('id', organizationId).maybeSingle();
  if (organization?.slug) {
    revalidatePath(`/tenant/${organization.slug}/retail`);
    revalidatePath(`/w/${encodeURIComponent(organization.slug)}/retail`);
  }
}
