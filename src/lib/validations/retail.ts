import { z } from 'zod';
import { MAX_CASHIER_DISCOUNT_PERCENT, normalizeCustomerPhone } from '../retail/checkout';

const RetailPhoneSchema = z.string().trim().transform(normalizeCustomerPhone)
  .refine((value) => /^\+?\d{7,15}$/.test(value), 'Enter a valid phone number with 7 to 15 digits.');

export const CompleteRetailCheckoutSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  discountPercent: z.number().finite().min(0).max(MAX_CASHIER_DISCOUNT_PERCENT)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Use no more than 2 decimal places.'),
  customer: z.object({
    name: z.string().trim().min(1).max(160),
    phone: RetailPhoneSchema,
  }).strict().nullable().optional(),
  tenders: z.array(z.object({
    method: z.enum(['cash', 'card', 'uber', 'pickme']),
    amount: z.number().finite().positive().max(100000000)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Tender amounts must use no more than 2 decimal places.'),
  }).strict()).min(1).max(4).superRefine((tenders, context) => {
    const methods = tenders.map(({ method }) => method);
    if (new Set(methods).size !== methods.length) {
      context.addIssue({ code: 'custom', message: 'Use each payment method once.', path: [] });
    }
  }),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().finite().positive().max(100000).refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, 'Use no more than 3 decimal places.'),
  })).min(1).max(100),
}).strict();
export const RecordRetailSaleSchema = CompleteRetailCheckoutSchema;
export type CompleteRetailCheckoutInput = z.infer<typeof CompleteRetailCheckoutSchema>;
export type RecordRetailSaleInput = CompleteRetailCheckoutInput;

export const SearchRetailCustomersSchema = z.object({
  organizationId: z.string().uuid(),
  query: z.string().trim().max(160).optional().default(''),
  limit: z.number().int().min(1).max(100).optional().default(100),
});
export type SearchRetailCustomersInput = z.infer<typeof SearchRetailCustomersSchema>;

export const UpsertRetailCustomerSchema = z.object({
  organizationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  phone: RetailPhoneSchema,
}).strict();
export type UpsertRetailCustomerInput = z.infer<typeof UpsertRetailCustomerSchema>;

const commissionRate = z.string().trim()
  .transform((value) => value === '' ? null : Number(value))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 100 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8),
    'Enter a percentage from 0 to 100, with up to 2 decimal places.');

export const UpdateRetailCommissionRatesSchema = z.object({
  organizationId: z.string().uuid(),
  uberCommissionRate: commissionRate,
  pickmeCommissionRate: commissionRate,
}).strict();
export type UpdateRetailCommissionRatesInput = z.input<typeof UpdateRetailCommissionRatesSchema>;

export const AdjustInventorySchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityDelta: z.number().finite().refine((value) => value !== 0 && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, 'Use a non-zero quantity with no more than 3 decimal places.').max(1000000).min(-1000000),
  reason: z.string().trim().min(3).max(300),
});
export type AdjustInventoryInput = z.infer<typeof AdjustInventorySchema>;

export const UpdateStaffAssignmentSchema = z.object({
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roleId: z.string().uuid(),
  branchId: z.string().uuid(),
});
export type UpdateStaffAssignmentInput = z.infer<typeof UpdateStaffAssignmentSchema>;

export const BulkOpeningStockItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z
    .number()
    .finite()
    .min(0, 'Quantity must be at least 0.')
    .max(1000000, 'Quantity cannot exceed 1,000,000.')
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8,
      'Use no more than 3 decimal places.'
    ),
}).strict();

export const BulkOpeningStockSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  items: z.array(BulkOpeningStockItemSchema).min(1, 'Provide at least one stock item.').max(5000, 'Batch cannot exceed 5000 items.'),
}).strict();
export type BulkOpeningStockInput = z.infer<typeof BulkOpeningStockSchema>;
