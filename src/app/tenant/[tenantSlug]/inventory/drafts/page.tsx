import { notFound, redirect } from 'next/navigation';
import { requireTenantAccess } from '../../../../../lib/auth/tenant-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductDraftReviewPage(props: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await props.params;
  const returnPath = `/w/${encodeURIComponent(tenantSlug)}/inventory/drafts`;
  const access = await requireTenantAccess(tenantSlug, returnPath);

  if (!access.authorized) return null;

  const { organization } = access.context;
  if (organization.slug !== 'uk-super') notFound();

  redirect(`/w/${encodeURIComponent(tenantSlug)}/retail?section=inventory`);
}
