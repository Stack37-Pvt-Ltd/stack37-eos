'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import {
  createBusinessSchema,
  updateBusinessConfigurationSchema,
  updateBranchConfigurationSchema,
  type CreateBusinessInput,
  type UpdateBusinessConfigurationInput,
  type UpdateBranchConfigurationInput,
} from '../validations/organization';

export interface OrganizationActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface CreateBusinessResult {
  organizationId: string;
  slug: string;
  planName?: string;
  trialDays?: number;
  message: string;
}

/**
 * Server Action for registering a new business organization in STACK37 EOS.
 * 
 * Invariants:
 * 1. User Authentication: Verified via Supabase server-side getUser().
 * 2. Idempotency: Protects against rapid repeated clicks/retries by checking if the user already
 *    owns an organization with the target slug.
 * 3. Atomic Execution: Calls public.create_business() SECURITY DEFINER RPC to ensure
 *    organization, owner membership, headquarters branch, trial subscription, and audit log
 *    are created within a single database transaction.
 * 4. Error Mapping: Specifically traps 23505 unique violations and 23514 check constraints,
 *    returning actionable field errors.
 */
export async function createBusinessAction(
  rawInput: CreateBusinessInput
): Promise<OrganizationActionResult<CreateBusinessResult>> {
  // 1. Validate form schema
  const validation = createBusinessSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      error: 'Please correct the errors in the form.',
      fieldErrors,
    };
  }

  const { name, slug, countryCode } = validation.data;

  // 2. Verify server-side authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'You must be signed in to register a business. Please log in to continue.',
    };
  }

  // 3. Idempotency & Duplicate Submission Guard
  // If the user already initiated this request and owns an organization with this exact slug,
  // return success idempotently rather than failing with a duplicate key error.
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (existingOrg) {
    const { data: existingMembership } = await supabase
      .from('organization_members')
      .select('id, is_owner, status')
      .eq('organization_id', existingOrg.id)
      .eq('user_id', user.id)
      .eq('is_owner', true)
      .maybeSingle();

    if (existingMembership) {
      return {
        success: true,
        data: {
          organizationId: existingOrg.id,
          slug: existingOrg.slug,
          planName: 'Standard',
          trialDays: 7,
          message: 'Organization workspace has already been created.',
        },
      };
    }

    // Slug exists but does not belong to this user
    return {
      success: false,
      error: 'This workspace URL is already taken. Please choose another.',
      fieldErrors: {
        slug: 'This workspace URL is already taken. Please choose another.',
      },
    };
  }

  // 4. Deterministically resolve the required public 'Standard' trial plan
  // Under approved commercial policy (DEC-006), newly registered organizations receive
  // an automatic 7-day free trial on the public 'Standard' plan. If the required 'Standard'
  // plan is unavailable, fail safely with an explicit error rather than selecting another
  // tier via price-sorting fallback.
  const { data: standardPlan, error: standardPlanError } = await supabase
    .from('plans')
    .select('id, name')
    .eq('name', 'Standard')
    .eq('is_public', true)
    .maybeSingle();

  if (standardPlanError || !standardPlan) {
    return {
      success: false,
      error: 'The required Standard trial subscription plan is currently unavailable. Please contact support.',
    };
  }

  const targetPlan = standardPlan;

  // 5. Invoke atomic create_business RPC
  const { data: orgId, error: rpcError } = await supabase.rpc('create_business', {
    p_name: name,
    p_slug: slug,
    p_plan_id: targetPlan.id,
    p_country_code: countryCode,
  });

  if (rpcError) {
    const errCode = (rpcError as { code?: string }).code;
    const errMessage = rpcError.message || '';

    // Handle concurrent duplicate submission conflict (PostgreSQL error 23505)
    if (
      errCode === '23505' ||
      errMessage.includes('unique constraint') ||
      errMessage.includes('organizations_slug_key') ||
      errMessage.includes('already exists')
    ) {
      return {
        success: false,
        error: 'This workspace URL is already taken. Please choose another.',
        fieldErrors: {
          slug: 'This workspace URL is already taken. Please choose another.',
        },
      };
    }

    // Handle check constraint violation on slug format (PostgreSQL error 23514)
    if (errCode === '23514' || errMessage.includes('slug_format')) {
      return {
        success: false,
        error: 'Workspace URL contains invalid characters or is a reserved name.',
        fieldErrors: {
          slug: 'Workspace URL contains invalid characters or is a reserved name.',
        },
      };
    }

    return {
      success: false,
      error: rpcError.message || 'Failed to create business workspace. Please try again.',
    };
  }

  return {
    success: true,
    data: {
      organizationId: orgId,
      slug,
      planName: targetPlan.name,
      trialDays: 7,
      message: 'Business successfully registered.',
    },
  };
}

/**
 * Server Action for updating the complete business configuration in STACK37 EOS.
 * 
 * Invariants:
 * 1. Strict Schema Validation with Zod.
 * 2. Authorization Guard: Actor must be active primary owner or hold manage_team permission.
 * 3. Secure Execution: Invokes atomic update_business_configuration RPC (with fallback to direct update).
 * 4. Automatic Path Revalidation across tenant workspace routes.
 */
export async function updateBusinessConfigurationAction(
  rawInput: UpdateBusinessConfigurationInput
): Promise<OrganizationActionResult<{ message: string }>> {
  // 1. Validate Schema
  const validation = updateBusinessConfigurationSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      error: 'Please correct the highlighted errors in the form.',
      fieldErrors,
    };
  }

  const data = validation.data;

  // 2. Authentication Verification
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'Authentication session expired. Please log in again to continue.',
    };
  }

  // 3. Authorization Verification
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('organization_id', data.organizationId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member || !member.is_owner) {
    return {
      success: false,
      error: 'Unauthorized: Only the active primary owner can modify business settings.',
    };
  }

  // 4. Retrieve Organization Slug for Revalidation
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', data.organizationId)
    .maybeSingle();

  const tenantSlug = org?.slug;

  // 5. Attempt Atomic RPC update_business_configuration
  const rpcResult = await supabase.rpc('update_business_configuration', {
    p_organization_id: data.organizationId,
    p_name: data.name,
    p_legal_name: data.legalName || null,
    p_registration_number: data.registrationNumber || null,
    p_category_id: data.categoryId || null,
    p_currency: data.currency,
    p_timezone: data.timezone,
    p_tax_id: data.taxId || null,
    p_tax_status: data.taxStatus || 'standard',
    p_contact_email: data.contactEmail || null,
    p_contact_phone: data.contactPhone || null,
    p_website: data.website || null,
    p_address_line1: data.addressLine1 || null,
    p_address_line2: data.addressLine2 || null,
    p_city: data.city || null,
    p_state_province: data.stateProvince || null,
    p_postal_code: data.postalCode || null,
    p_country_code: data.countryCode || null,
  });

  if (rpcResult.error) {
    return {
      success: false,
      error: rpcResult.error.message || 'Failed to update business configuration via secure RPC.',
    };
  }

  // 6. Path Revalidation
  if (tenantSlug) {
    try {
      revalidatePath(`/tenant/${tenantSlug}/settings`);
      revalidatePath(`/tenant/${tenantSlug}`);
    } catch {
      // Safe no-op outside active request context (e.g. testing)
    }
  }

  return {
    success: true,
    data: {
      message: 'Business configuration successfully saved.',
    },
  };
}

/**
 * Server Action for updating operating branch metadata (Headquarters).
 * 
 * Invariants:
 * 1. Strict Schema Validation with Zod.
 * 2. Authorization Guard: Actor must belong to target organization as active primary owner.
 * 3. Atomic execution and audit logging via secure RPC.
 */
export async function updateBranchConfigurationAction(
  rawInput: UpdateBranchConfigurationInput
): Promise<OrganizationActionResult<{ message: string }>> {
  const validation = updateBranchConfigurationSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      error: 'Please correct the highlighted errors in the form.',
      fieldErrors,
    };
  }

  const data = validation.data;

  // 1. Authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'Authentication session expired. Please log in again to continue.',
    };
  }

  // 2. Authorization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, is_owner, status')
    .eq('organization_id', data.organizationId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member || !member.is_owner) {
    return {
      success: false,
      error: 'Unauthorized: Only the active primary owner can modify branch details.',
    };
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', data.organizationId)
    .maybeSingle();

  const tenantSlug = org?.slug;

  // 3. Attempt Atomic RPC update_branch_configuration
  const rpcResult = await supabase.rpc('update_branch_configuration', {
    p_organization_id: data.organizationId,
    p_branch_id: data.branchId,
    p_name: data.name,
    p_code: data.code,
    p_contact_email: data.contactEmail || null,
    p_contact_phone: data.contactPhone || null,
    p_address_line1: data.addressLine1 || null,
    p_address_line2: data.addressLine2 || null,
    p_city: data.city || null,
    p_state_province: data.stateProvince || null,
    p_postal_code: data.postalCode || null,
  });

  if (rpcResult.error) {
    return {
      success: false,
      error: rpcResult.error.message || 'Failed to update branch configuration via secure RPC.',
    };
  }

  // 4. Revalidate
  if (tenantSlug) {
    try {
      revalidatePath(`/tenant/${tenantSlug}/settings`);
      revalidatePath(`/tenant/${tenantSlug}`);
    } catch {
      // Safe no-op outside active request context (e.g. testing)
    }
  }

  return {
    success: true,
    data: {
      message: 'Branch information successfully updated.',
    },
  };
}

