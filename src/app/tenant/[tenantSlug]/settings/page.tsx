import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireTenantAccess } from '../../../../lib/auth/tenant-guard';
import { getBusinessConfiguration } from '../../../../lib/auth/business-config';
import { BusinessConfigurationForm } from '../../../../components/tenant/business-configuration-form';
import { ArrowLeft, Sliders } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Business settings — My Business by STACK37',
  description: 'Manage legal entity identity, contact channels, operating currency, tax settings, and Headquarters branch.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TenantSettingsPage(props: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const params = await props.params;
  const access = await requireTenantAccess(params.tenantSlug);

  if (!access.authorized) {
    return null;
  }

  const { organization, membership } = access.context;
  const configData = await getBusinessConfiguration(organization.id, membership.id);

  if (!configData) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-none p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">Workspace Configuration Unavailable</p>
        <p className="text-xs text-slate-500 mt-1">
          Unable to resolve business configuration for this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link
              href="/"
              className="hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Overview</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Settings</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Business settings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Business profile and operating details.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
            <Sliders className="h-3.5 w-3.5 text-blue-600" />
            <span>Settings</span>
          </span>
        </div>
      </div>

      {/* Main Configuration Form Component */}
      <BusinessConfigurationForm initialData={configData} />
    </div>
  );
}
