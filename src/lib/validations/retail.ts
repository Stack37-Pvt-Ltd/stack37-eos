import { z } from 'zod';

export const RecordRetailSaleSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  paymentMethod: z.enum(['cash', 'external_card']),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().finite().positive().max(100000).refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, 'Use no more than 3 decimal places.'),
  })).min(1).max(100),
});
export type RecordRetailSaleInput = z.infer<typeof RecordRetailSaleSchema>;

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
