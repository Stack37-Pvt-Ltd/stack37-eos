import { notFound } from 'next/navigation';
import { SupermarketDemoWorkspace } from '../../../../../components/tenant/supermarket-demo';
import { requireTenantAccess } from '../../../../../lib/auth/tenant-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LocalRetailDemoPage(props: {
  params: Promise<{ tenantSlug: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { tenantSlug } = await props.params;
  const access = await requireTenantAccess(tenantSlug);
  if (!access.authorized) return null;

  return <SupermarketDemoWorkspace />;
}