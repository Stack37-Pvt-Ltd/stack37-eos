import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getBusinessConfiguration } from '../../../../lib/auth/business-config';
import { requireTenantAccess } from '../../../../lib/auth/tenant-guard';
import { supportsRetailOperations } from '../../../../lib/industry/category-features';
import { createClient } from '../../../../lib/supabase/server';
import { normalizeBranchRelation } from '../../../../lib/retail/branch-assignment';
import { RetailLiveWorkspace } from '../../../../components/tenant/retail-live-workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RetailOperationsPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ section?: string | string[]; branch?: string | string[] }>;
}) {
  const [{ tenantSlug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const returnPath = `/w/${encodeURIComponent(tenantSlug)}/retail`;
  const access = await requireTenantAccess(tenantSlug, returnPath);

  if (!access.authorized) return null;

  const { organization, membership } = access.context;
  const configuration = await getBusinessConfiguration(organization.id, membership.id);
  const categoryName = configuration?.organization.categoryName;

  if (!supportsRetailOperations(categoryName)) {
    return (
      <section className="max-w-2xl space-y-4">
        <p className="eyebrow">Industry tools</p>
        <h1 className="text-2xl font-semibold tracking-tight">Retail &amp; E-Commerce is not enabled</h1>
        <p className="text-sm leading-6 text-slate-600">
          Set this workspace’s business category to Retail &amp; E-Commerce in Business Settings, then save your changes to enable its operations workspace.
        </p>
        <Link href={`/w/${encodeURIComponent(tenantSlug)}/settings`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-blue hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Open Business Settings
        </Link>
      </section>
    );
  }

  const supabase = await createClient();
  let branches: Array<{ id: string; name: string }> = [];
  let products: Array<{ id: string; name: string; sku: string; barcode: string | null; selling_price: number; cost_price?: number; category_name?: string; quantity: number }> = [];
  let dashboard: { salesToday: number; grossSalesToday: number; itemsSoldToday: number; activeProducts: number; lowStockProducts: number; pendingDraftReviews: number; currency: string } | null = null;
  let loadError: string | undefined;
  let inventoryPermission = false;
  let salesPermission = false;
  let customerReadPermission = false;
  let customerManagePermission = false;
  try {
    const [{ data: assignments, error: branchError }, { data: member }, { data: memberRoles }] = await Promise.all([
      supabase.from('membership_branches').select('branch_id, branches(id, name)').eq('organization_id', organization.id).eq('membership_id', membership.id),
      supabase.from('organization_members').select('is_owner').eq('organization_id', organization.id).eq('id', membership.id).maybeSingle(),
      supabase.from('membership_roles').select('role_id').eq('organization_id', organization.id).eq('membership_id', membership.id),
    ]);
    if (branchError) throw branchError;
    branches = (assignments || []).flatMap((row) => normalizeBranchRelation(row.branches));
    const roleIds = (memberRoles || []).map((row) => row.role_id);
    if (member?.is_owner) { inventoryPermission = true; salesPermission = true; customerReadPermission = true; customerManagePermission = true; }
    else if (roleIds.length) {
      const { data: grants } = await supabase.from('role_permissions').select('permission_id').eq('organization_id', organization.id).in('role_id', roleIds);
      const permissions = new Set((grants || []).map((grant) => grant.permission_id));
      inventoryPermission = permissions.has('inventory_edit'); salesPermission = permissions.has('pos_checkout');
      customerReadPermission = permissions.has('customers_read') || permissions.has('customers_manage');
      customerManagePermission = permissions.has('customers_manage');
    }
    const requestedBranch = typeof searchParams.branch === 'string' ? searchParams.branch : null;
    const branchId = branches.find((branch) => branch.id === requestedBranch)?.id || branches[0]?.id || null;
    if (branchId) {
      const [{ data: catalog, error: catalogError }, { data: balances, error: balanceError }, { data: totals, error: totalsError }] = await Promise.all([
        supabase.from('products').select('id, name, sku, barcode, selling_price, cost_price, category_name').eq('organization_id', organization.id).eq('is_active', true).order('name').limit(2000),
        supabase.from('inventory_balances').select('product_id, quantity').eq('organization_id', organization.id).eq('branch_id', branchId),
        supabase.rpc('get_retail_dashboard', { p_organization_id: organization.id, p_branch_id: branchId }),
      ]);
      if (catalogError) throw catalogError; if (balanceError) throw balanceError; if (totalsError) throw totalsError;
      const quantityByProduct = new Map((balances || []).map((balance) => [balance.product_id, Number(balance.quantity)]));
      products = (catalog || []).map((product) => ({
        ...product,
        selling_price: Number(product.selling_price),
        cost_price: product.cost_price != null ? Number(product.cost_price) : undefined,
        category_name: product.category_name || undefined,
        quantity: quantityByProduct.get(product.id) || 0,
      }));
      dashboard = totals as typeof dashboard;
    }
    if (!branches.length) loadError = 'No branch is assigned to this account.';
  } catch {
    loadError = 'Retail data could not be loaded. The retail database changes may not be installed in this environment.';
  }
  const requestedBranch = typeof searchParams.branch === 'string' ? searchParams.branch : null;
  const branchId = branches.find((branch) => branch.id === requestedBranch)?.id || branches[0]?.id || null;
  return <RetailLiveWorkspace organizationId={organization.id} organizationSlug={organization.slug} organizationName={organization.name} branchId={branchId} branches={branches} products={products} dashboard={dashboard} isOwner={membership.is_owner} inventoryPermission={inventoryPermission} salesPermission={salesPermission} customerReadPermission={customerReadPermission} customerManagePermission={customerManagePermission} customerWritesEnabled={process.env.VERCEL_ENV !== 'preview'} uberCommissionRate={configuration?.organization.uberCommissionRate ?? null} pickmeCommissionRate={configuration?.organization.pickmeCommissionRate ?? null} loadError={loadError} />;
}
