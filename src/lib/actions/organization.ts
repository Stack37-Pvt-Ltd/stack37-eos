'use server';

import { createClient } from '../supabase/server';
import {
  createBusinessSchema,
  type CreateBusinessInput,
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

  // 4. Deterministically resolve the public 'Standard' trial plan
  // Explicitly query for 'Standard' first so that even if other public plans
  // (such as Starter or legacy tiers) co-exist in public.plans, the approved
  // 7-day trial tier is deterministically selected.
  const { data: standardPlan, error: standardPlanError } = await supabase
    .from('plans')
    .select('id, name')
    .eq('name', 'Standard')
    .eq('is_public', true)
    .maybeSingle();

  let targetPlan = standardPlan;

  // Fallback to lowest-priced public plan only if 'Standard' is not yet seeded
  if (!targetPlan && !standardPlanError) {
    const { data: fallbackPlan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('is_public', true)
      .order('price', { ascending: true })
      .limit(1)
      .maybeSingle();
    targetPlan = fallbackPlan;
  }

  if (standardPlanError || !targetPlan) {
    return {
      success: false,
      error: 'No public subscription plan is currently configured. Please contact the administrator.',
    };
  }

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
