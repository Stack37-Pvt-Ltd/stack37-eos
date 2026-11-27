import { z } from 'zod';

export * from '../actions/product-staging';

export const REVIEW_FLAGS = [
  'MISSING_BARCODE',
  'INVALID_BARCODE',
  'DUPLICATE_BARCODE',
  'SUGGESTED_NAME_BARCODE_SWAP',
  'NAME_REVIEW',
  'CATEGORY_REVIEW',
  'RETAIL_BELOW_WHOLESALE',
  'SOURCE_QUANTITY_IGNORED',
  'PRICE_REVIEW',
] as const;

export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

export const DRAFT_STATUSES = ['staged', 'reviewed', 'resolved', 'published', 'rejected'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const SuggestedProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  barcode: z.string().nullable().optional(),
  source_category: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  wholesale_price_lkr: z.number().nullable().optional(),
  retail_price_lkr: z.number().nullable().optional(),
  sku: z.string().nullable().optional(),
  opening_stock_quantity: z.null().optional(), // Strictly null (zero opening stock invariant)
  tax_percent: z.number().nullable().optional(),
});

export const ProductDraftItemSchema = z.object({
  source_file: z.string().min(1, 'Source file name is required'),
  source_id: z.number().int().positive('Source ID must be a positive integer'),
  source_raw: z.record(z.string(), z.unknown()),
  suggested_product: SuggestedProductSchema,
  review_flags: z.array(z.string()).default([]),
});

export type ProductDraftItem = z.infer<typeof ProductDraftItemSchema>;

export const ResolveProductDraftSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  source_category: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  wholesale_price: z.number().min(0).nullable().optional(),
  retail_price: z.number().min(0).nullable().optional(),
  status: z.enum(['staged', 'reviewed', 'resolved', 'rejected']).optional(),
  resolution_notes: z.string().optional(),
});

export type ResolveProductDraftInput = z.infer<typeof ResolveProductDraftSchema>;

export interface ProductDraftRow {
  id: string;
  organization_id: string;
  source_file: string;
  source_id: number;
  source_raw: Record<string, unknown>;
  name: string;
  barcode: string | null;
  source_category: string | null;
  company_name: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  sku: string | null;
  review_flags: string[];
  status: DraftStatus;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StagingSummary {
  organization_id: string;
  total_staged: number;
  by_status: Record<string, number>;
  flagged_total: number;
  by_flag: Record<string, number>;
}

export interface StageDraftsResult {
  success: boolean;
  batch_size: number;
  total_staged: number;
  flagged_count: number;
  flag_summary: Record<string, number>;
}

export interface PublishDraftsResult {
  success: boolean;
  published_count: number;
  failed_count: number;
  errors: Array<{
    draft_id: string;
    source_id: number;
    error: string;
    barcode?: string;
    sku?: string;
  }>;
}

