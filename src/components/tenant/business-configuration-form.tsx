'use client';

import * as React from 'react';
import {
  Building2,
  MapPin,
  Receipt,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
  Phone,
  Globe,
  GitBranch,
} from 'lucide-react';
import {
  updateBusinessConfigurationAction,
  updateBranchConfigurationAction,
} from '../../lib/actions/organization';
import {
  SUPPORTED_CURRENCIES,
  COMMON_TIMEZONES,
  TAX_STATUSES,
} from '../../lib/validations/organization';
import type { BusinessConfigurationData } from '../../lib/auth/business-config';
import { RetailCommissionRatesForm } from './retail-commission-rates-form';
import { supportsRetailOperations } from '../../lib/industry/category-features';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BusinessConfigurationFormProps {
  initialData: BusinessConfigurationData;
}

export function BusinessConfigurationForm({ initialData }: BusinessConfigurationFormProps) {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'contact' | 'tax' | 'branch' | 'retailRates'>('profile');

  // Business Configuration Form State
  const [profile, setProfile] = React.useState({
    name: initialData.organization.name || '',
    legalName: initialData.organization.legalName || '',
    registrationNumber: initialData.organization.registrationNumber || '',
    categoryId: UUID_PATTERN.test(initialData.organization.categoryId || '') ? initialData.organization.categoryId || '' : '',
    contactEmail: initialData.organization.contactEmail || '',
    contactPhone: initialData.organization.contactPhone || '',
    website: initialData.organization.website || '',
    addressLine1: initialData.organization.addressLine1 || '',
    addressLine2: initialData.organization.addressLine2 || '',
    city: initialData.organization.city || '',
    stateProvince: initialData.organization.stateProvince || '',
    postalCode: initialData.organization.postalCode || '',
    countryCode: initialData.organization.countryCode || '',
    currency: initialData.organization.currency || initialData.organization.suggestedCurrency || '',
    timezone: initialData.organization.timezone || initialData.organization.suggestedTimezone || '',
    taxId: initialData.organization.taxId || '',
    taxStatus: initialData.organization.taxStatus || 'standard',
  });

  // Branch Configuration Form State
  const [branch, setBranch] = React.useState({
    name: initialData.headquartersBranch?.name || 'Headquarters',
    code: initialData.headquartersBranch?.code || 'HQ',
    contactEmail: initialData.headquartersBranch?.contactEmail || '',
    contactPhone: initialData.headquartersBranch?.contactPhone || '',
    addressLine1: initialData.headquartersBranch?.addressLine1 || '',
    addressLine2: initialData.headquartersBranch?.addressLine2 || '',
    city: initialData.headquartersBranch?.city || '',
    stateProvince: initialData.headquartersBranch?.stateProvince || '',
    postalCode: initialData.headquartersBranch?.postalCode || '',
  });

  // Form submission states
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingBranch, setIsSavingBranch] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const isSavingBusinessRef = React.useRef(false);
  const isSavingBranchRef = React.useRef(false);

  const canEdit = initialData.canEdit;
  const categoryOptions = initialData.categories.filter((category) => UUID_PATTERN.test(category.id));
  const retailSettingsEnabled = supportsRetailOperations(initialData.organization.categoryName);

  async function handleSaveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || isSavingBusinessRef.current) return;

    isSavingBusinessRef.current = true;
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const result = await updateBusinessConfigurationAction({
        organizationId: initialData.organization.id,
        name: profile.name,
        legalName: profile.legalName,
        registrationNumber: profile.registrationNumber,
        categoryId: categoryOptions.length === 0
          ? (UUID_PATTERN.test(initialData.organization.categoryId || '') ? initialData.organization.categoryId || '' : '')
          : profile.categoryId,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        website: profile.website,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        stateProvince: profile.stateProvince,
        postalCode: profile.postalCode,
        countryCode: profile.countryCode,
        currency: profile.currency,
        timezone: profile.timezone,
        taxId: profile.taxId,
        taxStatus: profile.taxStatus as (typeof TAX_STATUSES)[number],
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to save business configuration.');
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        setSuccessMessage('Business settings saved.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
      isSavingBusinessRef.current = false;
    }
  }

  async function handleSaveBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !initialData.headquartersBranch?.id || isSavingBranchRef.current) return;

    isSavingBranchRef.current = true;
    setIsSavingBranch(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const result = await updateBranchConfigurationAction({
        organizationId: initialData.organization.id,
        branchId: initialData.headquartersBranch.id,
        name: branch.name,
        code: branch.code,
        contactEmail: branch.contactEmail,
        contactPhone: branch.contactPhone,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        stateProvince: branch.stateProvince,
        postalCode: branch.postalCode,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to save branch information.');
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        setSuccessMessage('Headquarters saved.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSavingBranch(false);
      isSavingBranchRef.current = false;
    }
  }

  return (
    <div className="settings-form space-y-6">
      {/* Read-only Advisory Banner */}
      {!canEdit && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-none p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Read-Only View</p>
            <p className="mt-0.5 text-amber-700">
              You are viewing business settings in read-only mode. Only the Primary Owner can make modifications.
            </p>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {successMessage && (
        <div role="status" className="bg-blue-50 border border-blue-200 rounded-none p-4 flex items-center justify-between text-xs text-blue-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-none p-4 flex items-center justify-between text-xs text-rose-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      {Object.keys(fieldErrors).length > 0 && (
        <div role="alert" className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Check these details</p>
          <ul className="mt-2 list-inside list-disc">{Object.entries(fieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}</ul>
        </div>
      )}
      <div className="settings-tabs" role="group" aria-label="Business settings sections">
        <button
          type="button"
          aria-pressed={activeTab === 'profile'}
          aria-controls="settings-panel"
          onClick={() => { setActiveTab('profile'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-white text-slate-900  border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-4 w-4 text-blue-600" />
          <span>Business identity</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'contact'}
          aria-controls="settings-panel"
          onClick={() => { setActiveTab('contact'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold transition-all ${
            activeTab === 'contact'
              ? 'bg-white text-slate-900  border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="h-4 w-4 text-blue-600" />
          <span>Contact & address</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'tax'}
          aria-controls="settings-panel"
          onClick={() => { setActiveTab('tax'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold transition-all ${
            activeTab === 'tax'
              ? 'bg-white text-slate-900  border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="h-4 w-4 text-blue-600" />
          <span>Regional & tax</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'branch'}
          aria-controls="settings-panel"
          onClick={() => { setActiveTab('branch'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold transition-all ${
            activeTab === 'branch'
              ? 'bg-white text-slate-900  border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch className="h-4 w-4 text-blue-600" />
          <span>Headquarters</span>
        </button>
        {retailSettingsEnabled && <button
          type="button"
          aria-pressed={activeTab === 'retailRates'}
          aria-controls="settings-panel"
          onClick={() => { setActiveTab('retailRates'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold transition-all ${
            activeTab === 'retailRates'
              ? 'bg-white text-slate-900 border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="h-4 w-4 text-blue-600" />
          <span>Retail payment rates</span>
        </button>}
      </div>

      {/* Main Tab Panels */}
      {activeTab === 'retailRates' && retailSettingsEnabled ? (
        <RetailCommissionRatesForm
          organizationId={initialData.organization.id}
          canEdit={canEdit}
          uberRate={initialData.organization.uberCommissionRate}
          pickmeRate={initialData.organization.pickmeCommissionRate}
        />
      ) : activeTab !== 'branch' ? (
      <form id="settings-panel" onSubmit={handleSaveBusiness} className="space-y-6" aria-busy={isSaving}>
          {/* TAB 1: Business identity */}
          {activeTab === 'profile' && (
            <div className="settings-panel space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">Business identity</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Business name and registered details.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Trading Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Business name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="e.g. Acme Corporation"
                  />
                  {fieldErrors.name && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Slug (Read-only subdomain badge) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Workspace address
                  </label>
                  <div className="flex min-w-0 items-center rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 select-all">
                    <span className="break-all">https://mybusiness.stack37.com/w/{initialData.organization.slug}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Permanent workspace path on the centralized STACK37 portal.
                  </p>
                </div>

                {/* Legal Entity Name */}
                <div>
                  <label htmlFor="legalName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Legal name
                  </label>
                  <input
                    id="legalName"
                    type="text"
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.legalName}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="e.g. Acme Logistics Private Limited"
                  />
                  {fieldErrors.legalName && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.legalName}</p>
                  )}
                </div>

                {/* Business Registration Number */}
                <div>
                  <label htmlFor="registrationNumber" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Business registration number (BRN)
                  </label>
                  <input
                    id="registrationNumber"
                    type="text"
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.registrationNumber}
                    onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                    placeholder="e.g. PV-123456 / REG-7890"
                  />
                  {fieldErrors.registrationNumber && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.registrationNumber}</p>
                  )}
                </div>

                {/* Business Category */}
                <div className="md:col-span-2">
                  <label htmlFor="categoryId" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Industry
                  </label>
                  <select
                    id="categoryId"
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.categoryId}
                    onChange={(e) => setProfile({ ...profile, categoryId: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">{categoryOptions.length > 0 ? 'Select industry' : 'Category options unavailable'}</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.description ? `— ${cat.description}` : ''}
                      </option>
                    ))}
                  </select>
                  {categoryOptions.length === 0 && (
                    <p role="status" className="mt-2 text-xs leading-5 text-amber-800">
                      {initialData.hasCategoriesError
                        ? 'Unable to load industry categories at this time. Category changes are temporarily disabled.'
                        : 'Industry categories are unavailable from this environment. Category changes are disabled until valid categories are provided.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Contact & address */}
          {activeTab === 'contact' && (
            <div className="settings-panel space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">Contact & address</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Business contact and registered address.
                </p>
              </div>

              {/* Contact Channels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label htmlFor="contactEmail" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Contact email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      id="contactEmail"
                      type="email"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.contactEmail}
                      onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="info@yourcompany.com"
                    />
                  </div>
                  {fieldErrors.contactEmail && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.contactEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPhone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      id="contactPhone"
                      type="tel"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.contactPhone}
                      onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  {fieldErrors.contactPhone && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.contactPhone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="website" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Website
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      id="website"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.website}
                      onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                  {fieldErrors.website && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.website}</p>
                  )}
                </div>
              </div>

              {/* Registered Address */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  Registered address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label htmlFor="addressLine1" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Street address
                    </label>
                    <input
                      id="addressLine1"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.addressLine1}
                      onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="e.g. 100 Main Street, Suite 400"
                    />
                  </div>

                  <div>
                    <label htmlFor="addressLine2" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Address line 2
                    </label>
                    <input
                      id="addressLine2"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.addressLine2}
                      onChange={(e) => setProfile({ ...profile, addressLine2: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="Building, Floor, or Tower"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="e.g. Colombo / New York"
                    />
                  </div>

                  <div>
                    <label htmlFor="stateProvince" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      State / province
                    </label>
                    <input
                      id="stateProvince"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.stateProvince}
                      onChange={(e) => setProfile({ ...profile, stateProvince: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="e.g. Western Province / NY"
                    />
                  </div>

                  <div>
                    <label htmlFor="postalCode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Postal / ZIP Code
                    </label>
                    <input
                      id="postalCode"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={profile.postalCode}
                      onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                      placeholder="e.g. 00300 / 10001"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Regional & tax */}
          {activeTab === 'tax' && (
            <div className="settings-panel space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">Regional & tax</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Currency, timezone and tax details.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Operating Currency */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="currency" className="block text-xs font-semibold text-slate-700">
                      Operating Currency <span className="text-rose-500">*</span>
                    </label>
                    {profile.countryCode === 'LK' && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-none border border-blue-200/60">
                        LKR Recommended
                      </span>
                    )}
                  </div>
                  <select
                    id="currency"
                    required
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.currency}
                    onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                  >
                    <option value="">Select operating currency...</option>
                    {SUPPORTED_CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur} — {cur === 'USD' ? 'US Dollar' : cur === 'LKR' ? 'Sri Lankan Rupee (LKR)' : cur === 'EUR' ? 'Euro' : cur === 'GBP' ? 'British Pound' : cur === 'AUD' ? 'Australian Dollar' : cur === 'SGD' ? 'Singapore Dollar' : cur === 'AED' ? 'UAE Dirham' : cur}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.currency && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.currency}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Currency for business records.
                  </p>
                </div>

                {/* Operating Timezone */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="timezone" className="block text-xs font-semibold text-slate-700">
                      Operating Timezone <span className="text-rose-500">*</span>
                    </label>
                    {profile.countryCode === 'LK' && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-none border border-blue-200/60">
                        Asia/Colombo Recommended
                      </span>
                    )}
                  </div>
                  <select
                    id="timezone"
                    required
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                  >
                    <option value="">Select operating timezone...</option>
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz} {tz === 'Asia/Colombo' ? '(UTC+05:30 Sri Lanka)' : tz === 'UTC' ? '(Coordinated Universal Time)' : ''}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.timezone && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.timezone}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Timezone for business records.
                  </p>
                </div>

                {/* Tax / VAT Identification */}
                <div>
                  <label htmlFor="taxId" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tax identification number (TIN)
                  </label>
                  <input
                    id="taxId"
                    type="text"
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.taxId}
                    onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                    placeholder="e.g. VAT-123456789 / TIN-987654"
                  />
                  {fieldErrors.taxId && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.taxId}</p>
                  )}
                </div>

                {/* Tax Registration Scheme */}
                <div>
                  <label htmlFor="taxStatus" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tax status
                  </label>
                  <select
                    id="taxStatus"
                    disabled={!canEdit || categoryOptions.length === 0}
                    value={profile.taxStatus}
                    onChange={(e) => setProfile({ ...profile, taxStatus: e.target.value })}
                    className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 capitalize"
                  >
                    <option value="standard">Standard Business Tax Status</option>
                    <option value="vat_registered">Registered for VAT / GST</option>
                    <option value="exempt">Tax-Exempt Entity</option>
                    <option value="simplified">Simplified / Small Enterprise Scheme</option>
                  </select>
                  {categoryOptions.length === 0 && (
                    <p role="status" className="mt-2 text-xs leading-5 text-amber-800">
                      {initialData.hasCategoriesError
                        ? 'Unable to load industry categories at this time. Category changes are temporarily disabled.'
                        : 'Industry categories are unavailable from this environment. Category changes are disabled until valid categories are provided.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-xs font-semibold bg-brand-navy text-white hover:bg-slate-800 transition-colors  disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          )}
        </form>
      ) : (
        /* TAB 4: Headquarters */
        <form id="settings-panel" onSubmit={handleSaveBranch} className="space-y-6" aria-busy={isSavingBranch}>
          <div className="settings-panel space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Headquarters</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Your primary operating location.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  <span className="h-1.5 w-1.5 rounded-none bg-blue-500" />
                  Primary Facility
                </span>
                {initialData.headquartersBranch?.isOwnerAssigned && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Owner Linked
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Branch Name */}
              <div>
                <label htmlFor="branchName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="branchName"
                  type="text"
                  required
                  disabled={!canEdit || categoryOptions.length === 0}
                  value={branch.name}
                  onChange={(e) => setBranch({ ...branch, name: e.target.value })}
                  className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Headquarters"
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Branch Code */}
              <div>
                <label htmlFor="branchCode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location code
                </label>
                <input
                  id="branchCode"
                  type="text"
                  disabled={!canEdit || categoryOptions.length === 0}
                  value={branch.code}
                  onChange={(e) => setBranch({ ...branch, code: e.target.value })}
                  className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                  placeholder="HQ"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Short code for this location.
                </p>
              </div>

              {/* Branch Phone */}
              <div>
                <label htmlFor="branchPhone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone
                </label>
                <input
                  id="branchPhone"
                  type="tel"
                  disabled={!canEdit || categoryOptions.length === 0}
                  value={branch.contactPhone}
                  onChange={(e) => setBranch({ ...branch, contactPhone: e.target.value })}
                  className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Branch Email */}
              <div>
                <label htmlFor="branchEmail" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="branchEmail"
                  type="email"
                  disabled={!canEdit || categoryOptions.length === 0}
                  value={branch.contactEmail}
                  onChange={(e) => setBranch({ ...branch, contactEmail: e.target.value })}
                  className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="hq@yourcompany.com"
                />
              </div>

              {/* Physical Address */}
              <div className="md:col-span-2 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  Location address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label htmlFor="bAddressLine1" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Street address
                    </label>
                    <input
                      id="bAddressLine1"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={branch.addressLine1}
                      onChange={(e) => setBranch({ ...branch, addressLine1: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="e.g. 100 Commercial Avenue"
                    />
                  </div>

                  <div>
                    <label htmlFor="bCity" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      City
                    </label>
                    <input
                      id="bCity"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={branch.city}
                      onChange={(e) => setBranch({ ...branch, city: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label htmlFor="bPostalCode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Postal Code
                    </label>
                    <input
                      id="bPostalCode"
                      type="text"
                      disabled={!canEdit || categoryOptions.length === 0}
                      value={branch.postalCode}
                      onChange={(e) => setBranch({ ...branch, postalCode: e.target.value })}
                      className="w-full text-xs rounded-none border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                      placeholder="00300"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Branch Actions */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingBranch}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-xs font-semibold bg-brand-navy text-white hover:bg-slate-800 transition-colors  disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingBranch ? 'Saving…' : 'Save Headquarters'}</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
