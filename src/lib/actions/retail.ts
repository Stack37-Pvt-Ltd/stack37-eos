'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { AdjustInventorySchema, RecordRetailSaleSchema } from '../validations/retail';

export interface RetailActionResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function previewMutationBlocked(): RetailActionResult | null {
  return process.env.VERCEL_ENV === 'preview'
    ? { success: false, error: 'Retail changes are disabled in Preview to protect shared live business data.' }
    : null;
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
  taxTotal: number;
  total: number;
  paymentMethod: 'cash' | 'external_card';
  createdAt: string;
  replayed: boolean;
}>> {
  const previewBlock = previewMutationBlocked();
  if (previewBlock) return { success: false, error: previewBlock.error };
  const parsed = RecordRetailSaleSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: 'Check the basket and payment details.', fieldErrors: parsed.error.flatten().fieldErrors };
  const { organizationId, branchId, idempotencyKey, paymentMethod, lines } = parsed.data;
  const { supabase, error: accessError } = await verifyActiveMember(organizationId);
  if (accessError) return { success: false, error: accessError };

  const { data, error } = await supabase.rpc('record_retail_sale', {
    p_organization_id: organizationId,
    p_branch_id: branchId,
    p_idempotency_key: idempotencyKey,
    p_payment_method: paymentMethod,
    p_lines: lines.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
  });
  if (error || !data) return { success: false, error: error?.message || 'The sale could not be completed.' };

  await revalidateRetailPaths(supabase, organizationId);
  return { success: true, data: data as RetailActionResult['data'] & {
    saleId: string; receiptNumber: string; itemCount: number; subtotal: number; taxTotal: number;
    total: number; paymentMethod: 'cash' | 'external_card'; createdAt: string; replayed: boolean;
  } };
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

async function revalidateRetailPaths(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data: organization } = await supabase.from('organizations').select('slug').eq('id', organizationId).maybeSingle();
  if (organization?.slug) {
    revalidatePath(`/tenant/${organization.slug}/retail`);
    revalidatePath(`/w/${encodeURIComponent(organization.slug)}/retail`);
  }
}
