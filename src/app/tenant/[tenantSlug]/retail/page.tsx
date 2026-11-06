import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RetailOperationsWorkspace } from '../../../../components/tenant/retail-operations-workspace';
import { getBusinessConfiguration } from '../../../../lib/auth/business-config';
import { requireTenantAccess } from '../../../../lib/auth/tenant-guard';
import { supportsRetailOperations } from '../../../../lib/industry/category-features';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RetailOperationsPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
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

  const currencyCode = configuration?.organization.currency || configuration?.organization.suggestedCurrency || 'LKR';
  const initialSection = searchParams.section === 'inventory' ? 'inventory' : 'overview';
  return (
    <RetailOperationsWorkspace
      organizationId={organization.id}
      organizationSlug={organization.slug}
      organizationName={organization.name}
      currencyCode={currencyCode}
      initialSection={initialSection}
    />
  );
}
