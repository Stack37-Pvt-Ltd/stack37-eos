'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import {
  ProductDraftItemSchema,
  ResolveProductDraftSchema,
  type ResolveProductDraftInput,
  type StageDraftsResult,
  type PublishDraftsResult,
  type StagingSummary,
} from '../inventory/product-staging';

/**
 * Stage a batch of product drafts via audited security-definer RPC.
 */
export async function stageProductDraftsAction(
  organizationId: string,
  items: unknown[]
): Promise<{ success: boolean; data?: StageDraftsResult; error?: string }> {
  try {
    const parsedItems = z.array(ProductDraftItemSchema).parse(items);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('stage_product_drafts', {
      p_organization_id: organizationId,
      p_items: parsedItems,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as StageDraftsResult };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to stage product drafts';
    return { success: false, error: msg };
  }
}

/**
 * Update and resolve a specific product draft row.
 */
export async function resolveProductDraftAction(
  organizationId: string,
  draftId: string,
  updates: ResolveProductDraftInput
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const validated = ResolveProductDraftSchema.parse(updates);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('resolve_product_draft', {
      p_organization_id: organizationId,
      p_draft_id: draftId,
      p_updates: validated,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resolve product draft';
    return { success: false, error: msg };
  }
}

/**
 * Publish product drafts to the master catalog (public.products).
 */
export async function publishProductDraftsAction(
  organizationId: string,
  draftIds: string[],
  options?: { autoGenerateSku?: boolean; skuPrefix?: string }
): Promise<{ success: boolean; data?: PublishDraftsResult; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('publish_product_drafts', {
      p_organization_id: organizationId,
      p_draft_ids: draftIds,
      p_auto_generate_sku: options?.autoGenerateSku ?? true,
      p_sku_prefix: options?.skuPrefix ?? 'UKS-',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PublishDraftsResult };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to publish product drafts';
    return { success: false, error: msg };
  }
}

/**
 * Publish all clean (unflagged) or resolved product drafts for an organization.
 */
export async function publishCleanDraftsAction(
  organizationId: string,
  options?: { autoGenerateSku?: boolean; skuPrefix?: string }
): Promise<{ success: boolean; data?: PublishDraftsResult; error?: string }> {
  try {
    if (process.env.VERCEL_ENV === 'preview') {
      return { success: false, error: 'Publishing products is disabled in Preview to protect shared live business data.' };
    }

    const supabase = await createClient();

    const { data: eligibleDrafts, error: fetchError } = await supabase
      .from('product_drafts')
      .select('id, review_flags, status')
      .eq('organization_id', organizationId)
      .neq('status', 'rejected')
      .neq('status', 'published');

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const draftIds = (eligibleDrafts || [])
      .filter((d) => d.status === 'resolved' || !d.review_flags || d.review_flags.length === 0)
      .map((d) => d.id);

    if (draftIds.length === 0) {
      return { success: false, error: 'No clean or resolved drafts are available to publish.' };
    }

    const result = await publishProductDraftsAction(organizationId, draftIds, options);

    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', organizationId)
      .maybeSingle();

    if (org?.slug) {
      revalidatePath(`/tenant/${org.slug}/retail`);
      revalidatePath(`/w/${encodeURIComponent(org.slug)}/retail`);
      revalidatePath(`/tenant/${org.slug}/inventory/drafts`);
      revalidatePath(`/w/${encodeURIComponent(org.slug)}/inventory/drafts`);
    }

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to publish clean drafts';
    return { success: false, error: msg };
  }
}

/**
 * Fetch staging summary statistics for an organization.
 */
export async function getProductDraftSummary(
  organizationId: string
): Promise<StagingSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_product_draft_summary', {
      p_organization_id: organizationId,
    });

    if (error || !data) {
      return null;
    }

    return data as StagingSummary;
  } catch {
    return null;
  }
}
