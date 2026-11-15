import { z } from 'zod';

/**
 * Validation schema for inviting a new staff member (FEAT-TEAM-001)
 */
export const InviteStaffSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization identifier.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }).toLowerCase().trim(),
  roleId: z.string().uuid({ message: 'Please select a valid role.' }),
  branchId: z.string().uuid({ message: 'Please select a valid operating branch.' }),
});

export type InviteStaffInput = z.infer<typeof InviteStaffSchema>;

/**
 * Validation schema for accepting an invitation
 */
export const AcceptInvitationSchema = z.object({
  token: z.string().min(32, { message: 'Invalid invitation token format.' }).trim(),
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).max(100).optional(),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }).optional(),
});

export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

/**
 * Validation schema for staff access revocation and status changes
 */
export const RevokeStaffAccessSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization identifier.' }),
  membershipId: z.string().uuid({ message: 'Invalid membership identifier.' }),
  action: z.enum(['suspend', 'reinstate', 'remove'], {
    message: 'Action must be suspend, reinstate, or remove.',
  }),
});

export type RevokeStaffAccessInput = z.infer<typeof RevokeStaffAccessSchema>;

/**
 * Validation schema for canceling an unaccepted invitation
 */
export const CancelInvitationSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization identifier.' }),
  invitationId: z.string().uuid({ message: 'Invalid invitation identifier.' }),
});

export type CancelInvitationInput = z.infer<typeof CancelInvitationSchema>;

export const UpdateStaffAssignmentSchema = z.object({
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roleId: z.string().uuid(),
  branchId: z.string().uuid(),
});

export type UpdateStaffAssignmentInput = z.infer<typeof UpdateStaffAssignmentSchema>;
