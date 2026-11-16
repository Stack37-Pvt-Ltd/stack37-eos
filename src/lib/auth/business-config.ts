import { createClient } from '../supabase/server';

export interface BusinessCategoryItem {
  id: string;
  name: string;
  description?: string | null;
}

export interface BusinessConfigurationData {
  organization: {
    id: string;
    name: string;
    slug: string;
    legalName: string | null;
    registrationNumber: string | null;
    categoryId: string | null;
    categoryName: string | null;
    countryCode: string | null;
    currency: string;
    timezone: string;
    suggestedCurrency: string;
    suggestedTimezone: string;
    taxId: string | null;
    taxStatus: string;
    contactEmail: string | null;
    contactPhone: string | null;
    website: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    uberCommissionRate: number | null;
    pickmeCommissionRate: number | null;
    createdAt: string;
  };
  headquartersBranch: {
    id: string;
    name: string;
    code: string;
    isHeadquarters: boolean;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    isOwnerAssigned: boolean;
  } | null;
  categories: BusinessCategoryItem[];
  hasCategoriesError?: boolean;
  canEdit: boolean;
}

/**
 * @deprecated Legacy placeholder category array. Category options must originate from
 * the authoritative public.business_categories database table with valid UUIDs.
 */
export const CURATED_CATEGORIES: BusinessCategoryItem[] = [
  { id: 'cat-retail', name: 'Retail & E-Commerce', description: 'Consumer goods, storefronts, and online retail' },
  { id: 'cat-services', name: 'Professional Services', description: 'Consulting, legal, accounting, and advisory' },
  { id: 'cat-wholesale', name: 'Wholesale & Distribution', description: 'B2B distribution, supply chain, and logistics' },
  { id: 'cat-manufacturing', name: 'Manufacturing & Industrial', description: 'Production, processing, and assembly' },
  { id: 'cat-tech', name: 'Software & Technology', description: 'SaaS, digital products, IT, and telecom' },
  { id: 'cat-healthcare', name: 'Healthcare & Life Sciences', description: 'Clinics, pharmacies, medical equipment' },
  { id: 'cat-hospitality', name: 'Hospitality & Food Services', description: 'Hotels, restaurants, catering, and tourism' },
  { id: 'cat-construction', name: 'Construction & Real Estate', description: 'Building contracting, engineering, property' },
];

/**
 * Resolves the complete business configuration state for a workspace.
 * 
 * Features defensive query fallback:
 * - If extended columns are pending migration deployment, it falls back cleanly to base columns.
 * - Headquarters branch is resolved by is_headquarters flag first, then by name or earliest branch ID,
 *   ensuring resilience even if the branch is renamed.
 * - Currency and timezone are NOT silently forced to USD/UTC; explicit selection is supported and tracked.
 * - Business categories are loaded strictly from public.business_categories with valid database UUIDs.
 *   Query failures are logged server-side only and never expose database error details to users.
 */
export async function getBusinessConfiguration(
  organizationId: string,
  userMembershipId?: string
): Promise<BusinessConfigurationData | null> {
  const supabase = await createClient();

  // 1. Fetch Organization Configuration with fallback resilience
  let orgRow: Record<string, unknown> | null = null;

  // Try comprehensive select (including Migration 11 columns)
  const extendedQuery = await supabase
    .from('organizations')
    .select(`
      id, name, slug, category_id, country_code, created_at,
      legal_name, registration_number, tax_id, tax_status, currency, timezone,
      contact_email, contact_phone, website,
      address_line1, address_line2, city, state_province, postal_code,
      uber_commission_rate, pickme_commission_rate
    `)
    .eq('id', organizationId)
    .maybeSingle();

  if (extendedQuery.error) {
    // If extended columns do not exist yet (error 42703), safely fallback to base schema
    const baseQuery = await supabase
      .from('organizations')
      .select('id, name, slug, category_id, country_code, created_at')
      .eq('id', organizationId)
      .maybeSingle();

    if (baseQuery.error || !baseQuery.data) {
      return null;
    }
    orgRow = baseQuery.data as Record<string, unknown>;
  } else if (extendedQuery.data) {
    orgRow = extendedQuery.data as Record<string, unknown>;
  } else {
    return null;
  }

  // 2. Fetch Headquarters Branch with robust resolution (handles renamed branches)
  let branchRow: Record<string, unknown> | null = null;

  // Attempt 1: Query by is_headquarters = true (preferred post-Migration 11)
  const hqFlagQuery = await supabase
    .from('branches')
    .select(`
      id, name, organization_id, is_headquarters,
      code, contact_email, contact_phone,
      address_line1, address_line2, city, state_province, postal_code
    `)
    .eq('organization_id', organizationId)
    .eq('is_headquarters', true)
    .maybeSingle();

  if (!hqFlagQuery.error && hqFlagQuery.data) {
    branchRow = hqFlagQuery.data as Record<string, unknown>;
  } else {
    // Attempt 2: Query by legacy 'Headquarters' name with extended fields
    const hqNameExtendedQuery = await supabase
      .from('branches')
      .select(`
        id, name, organization_id,
        code, contact_email, contact_phone,
        address_line1, address_line2, city, state_province, postal_code
      `)
      .eq('organization_id', organizationId)
      .eq('name', 'Headquarters')
      .maybeSingle();

    if (!hqNameExtendedQuery.error && hqNameExtendedQuery.data) {
      branchRow = hqNameExtendedQuery.data as Record<string, unknown>;
    } else {
      // Attempt 3: If extended columns don't exist yet, query base schema by name
      const hqNameBaseQuery = await supabase
        .from('branches')
        .select('id, name, organization_id')
        .eq('organization_id', organizationId)
        .eq('name', 'Headquarters')
        .maybeSingle();

      if (!hqNameBaseQuery.error && hqNameBaseQuery.data) {
        branchRow = hqNameBaseQuery.data as Record<string, unknown>;
      } else {
        // Attempt 4: Ultimate fallback — resolve the earliest branch of this organization
        // (preserves configuration access even if headquarters was renamed before migration)
        const firstBranchQuery = await supabase
          .from('branches')
          .select('*')
          .eq('organization_id', organizationId)
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstBranchQuery.data) {
          branchRow = firstBranchQuery.data as Record<string, unknown>;
        }
      }
    }
  }

  // 3. Verify if owner is linked to this branch
  let isOwnerAssigned = false;
  if (branchRow && userMembershipId) {
    const { data: memBranch } = await supabase
      .from('membership_branches')
      .select('branch_id')
      .eq('organization_id', organizationId)
      .eq('membership_id', userMembershipId)
      .eq('branch_id', branchRow.id as string)
      .maybeSingle();
    isOwnerAssigned = !!memBranch;
  }

  // 4. Determine user edit capability (strictly active primary owner belonging to this organization)
  let canEdit = false;
  if (userMembershipId) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('is_owner, status, organization_id')
      .eq('organization_id', organizationId)
      .eq('id', userMembershipId)
      .maybeSingle();
    canEdit = Boolean(
      member &&
      member.organization_id === organizationId &&
      member.is_owner === true &&
      member.status === 'active'
    );
  }

  // 5. Fetch Business Categories from database with explicit error capture
  const { data: dbCategories, error: categoriesError } = await supabase
    .from('business_categories')
    .select('id, name, description')
    .order('name');

  if (categoriesError) {
    // Log internal database error server-side ONLY. Do not leak details to the client.
    console.error('[business-config] Failed to fetch business categories:', categoriesError.message);
  }

  // Strictly return authentic database categories with valid UUIDs.
  // Never fallback to non-UUID placeholder IDs like 'cat-retail'.
  const categories: BusinessCategoryItem[] =
    !categoriesError && dbCategories && dbCategories.length > 0
      ? dbCategories
      : [];

  const currentCategory = categories.find((c) => c.id === orgRow?.category_id);

  // Derive sensible country-specific defaults without silently forcing USD/UTC
  const countryCode = (orgRow.country_code as string) || null;
  const suggestedCurrency = countryCode === 'LK' ? 'LKR' : (countryCode === 'US' ? 'USD' : (countryCode === 'GB' ? 'GBP' : ''));
  const suggestedTimezone = countryCode === 'LK' ? 'Asia/Colombo' : (countryCode === 'US' ? 'America/New_York' : (countryCode === 'GB' ? 'Europe/London' : ''));

  return {
    organization: {
      id: orgRow.id as string,
      name: (orgRow.name as string) || '',
      slug: (orgRow.slug as string) || '',
      legalName: (orgRow.legal_name as string) || null,
      registrationNumber: (orgRow.registration_number as string) || null,
      categoryId: (orgRow.category_id as string) || null,
      categoryName: currentCategory?.name || null,
      countryCode,
      currency: (orgRow.currency as string) || '',
      timezone: (orgRow.timezone as string) || '',
      suggestedCurrency,
      suggestedTimezone,
      taxId: (orgRow.tax_id as string) || null,
      taxStatus: (orgRow.tax_status as string) || 'standard',
      contactEmail: (orgRow.contact_email as string) || null,
      contactPhone: (orgRow.contact_phone as string) || null,
      website: (orgRow.website as string) || null,
      addressLine1: (orgRow.address_line1 as string) || null,
      addressLine2: (orgRow.address_line2 as string) || null,
      city: (orgRow.city as string) || null,
      stateProvince: (orgRow.state_province as string) || null,
      postalCode: (orgRow.postal_code as string) || null,
      uberCommissionRate: orgRow.uber_commission_rate == null ? null : Number(orgRow.uber_commission_rate),
      pickmeCommissionRate: orgRow.pickme_commission_rate == null ? null : Number(orgRow.pickme_commission_rate),
      createdAt: (orgRow.created_at as string) || new Date().toISOString(),
    },
    headquartersBranch: branchRow
      ? {
          id: branchRow.id as string,
          name: (branchRow.name as string) || 'Headquarters',
          code: (branchRow.code as string) || 'HQ',
          isHeadquarters: Boolean(branchRow.is_headquarters ?? true),
          contactEmail: (branchRow.contact_email as string) || null,
          contactPhone: (branchRow.contact_phone as string) || null,
          addressLine1: (branchRow.address_line1 as string) || null,
          addressLine2: (branchRow.address_line2 as string) || null,
          city: (branchRow.city as string) || null,
          stateProvince: (branchRow.state_province as string) || null,
          postalCode: (branchRow.postal_code as string) || null,
          isOwnerAssigned,
        }
      : null,
    categories,
    hasCategoriesError: Boolean(categoriesError),
    canEdit,
  };
}
