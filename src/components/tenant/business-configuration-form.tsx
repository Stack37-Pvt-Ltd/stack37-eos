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

interface BusinessConfigurationFormProps {
  initialData: BusinessConfigurationData;
}

export function BusinessConfigurationForm({ initialData }: BusinessConfigurationFormProps) {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'contact' | 'tax' | 'branch'>('profile');

  // Business Configuration Form State
  const [profile, setProfile] = React.useState({
    name: initialData.organization.name || '',
    legalName: initialData.organization.legalName || '',
    registrationNumber: initialData.organization.registrationNumber || '',
    categoryId: initialData.organization.categoryId || '',
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

  const canEdit = initialData.canEdit;

  async function handleSaveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

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
        categoryId: profile.categoryId,
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
        setSuccessMessage('Business configuration saved successfully.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !initialData.headquartersBranch?.id) return;

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
        setSuccessMessage('Headquarters branch updated successfully.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSavingBranch(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Read-only Advisory Banner */}
      {!canEdit && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Read-Only View</p>
            <p className="mt-0.5 text-amber-700">
              Only the active Primary Owner can update business entity configuration, currency standards, tax registration, and operating branch details.
            </p>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-xs text-rose-800 animate-in fade-in duration-200">
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
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-100/80 border border-zinc-200/80 rounded-xl">
        <button
          type="button"
          onClick={() => { setActiveTab('profile'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span>Profile & Identity</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('contact'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'contact'
              ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span>Contact & Address</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('tax'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'tax'
              ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Receipt className="h-4 w-4 text-emerald-600" />
          <span>Localization & Tax</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('branch'); setSuccessMessage(null); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'branch'
              ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <GitBranch className="h-4 w-4 text-emerald-600" />
          <span>Headquarters Branch</span>
        </button>
      </div>

      {/* Main Tab Panels */}
      {activeTab !== 'branch' ? (
        <form onSubmit={handleSaveBusiness} className="space-y-6">
          {/* TAB 1: Profile & Identity */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-zinc-100 pb-4">
                <h2 className="text-base font-bold text-zinc-900">Business Identity & Profile</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Manage your public trading name, registered entity details, and primary business classification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Trading Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Trading / Business Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    disabled={!canEdit}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                    placeholder="e.g. Acme Corporation"
                  />
                  {fieldErrors.name && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Slug (Read-only subdomain badge) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Workspace Subdomain (Protected)
                  </label>
                  <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-600 select-all">
                    <span>{initialData.organization.slug}</span>
                    <span className="text-zinc-400">.stack37.com</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Permanent subdomain routing key for tenant workspace isolation.
                  </p>
                </div>

                {/* Legal Entity Name */}
                <div>
                  <label htmlFor="legalName" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Registered Legal Entity Name
                  </label>
                  <input
                    id="legalName"
                    type="text"
                    disabled={!canEdit}
                    value={profile.legalName}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                    placeholder="e.g. Acme Logistics Private Limited"
                  />
                  {fieldErrors.legalName && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.legalName}</p>
                  )}
                </div>

                {/* Business Registration Number */}
                <div>
                  <label htmlFor="registrationNumber" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Business / Incorporation Number
                  </label>
                  <input
                    id="registrationNumber"
                    type="text"
                    disabled={!canEdit}
                    value={profile.registrationNumber}
                    onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
                    placeholder="e.g. PV-123456 / REG-7890"
                  />
                  {fieldErrors.registrationNumber && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.registrationNumber}</p>
                  )}
                </div>

                {/* Business Category */}
                <div className="md:col-span-2">
                  <label htmlFor="categoryId" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Business Category / Industry
                  </label>
                  <select
                    id="categoryId"
                    disabled={!canEdit}
                    value={profile.categoryId}
                    onChange={(e) => setProfile({ ...profile, categoryId: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                  >
                    <option value="">Select industry classification...</option>
                    {initialData.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.description ? `— ${cat.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Contact & Registered Address */}
          {activeTab === 'contact' && (
            <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-zinc-100 pb-4">
                <h2 className="text-base font-bold text-zinc-900">Contact & Registered Address</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Official correspondence channels and legal registered office address.
                </p>
              </div>

              {/* Contact Channels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label htmlFor="contactEmail" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Primary Contact Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      id="contactEmail"
                      type="email"
                      disabled={!canEdit}
                      value={profile.contactEmail}
                      onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="info@yourcompany.com"
                    />
                  </div>
                  {fieldErrors.contactEmail && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.contactEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPhone" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Primary Business Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      id="contactPhone"
                      type="tel"
                      disabled={!canEdit}
                      value={profile.contactPhone}
                      onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  {fieldErrors.contactPhone && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.contactPhone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="website" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Website URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      id="website"
                      type="text"
                      disabled={!canEdit}
                      value={profile.website}
                      onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                  {fieldErrors.website && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.website}</p>
                  )}
                </div>
              </div>

              {/* Registered Address */}
              <div className="pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-4">
                  Registered Business Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label htmlFor="addressLine1" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Street Address Line 1
                    </label>
                    <input
                      id="addressLine1"
                      type="text"
                      disabled={!canEdit}
                      value={profile.addressLine1}
                      onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="e.g. 100 Main Street, Suite 400"
                    />
                  </div>

                  <div>
                    <label htmlFor="addressLine2" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      id="addressLine2"
                      type="text"
                      disabled={!canEdit}
                      value={profile.addressLine2}
                      onChange={(e) => setProfile({ ...profile, addressLine2: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="Building, Floor, or Tower"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      City / Town
                    </label>
                    <input
                      id="city"
                      type="text"
                      disabled={!canEdit}
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="e.g. Colombo / New York"
                    />
                  </div>

                  <div>
                    <label htmlFor="stateProvince" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      State / Province / District
                    </label>
                    <input
                      id="stateProvince"
                      type="text"
                      disabled={!canEdit}
                      value={profile.stateProvince}
                      onChange={(e) => setProfile({ ...profile, stateProvince: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="e.g. Western Province / NY"
                    />
                  </div>

                  <div>
                    <label htmlFor="postalCode" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Postal / ZIP Code
                    </label>
                    <input
                      id="postalCode"
                      type="text"
                      disabled={!canEdit}
                      value={profile.postalCode}
                      onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
                      placeholder="e.g. 00300 / 10001"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Localization & Tax */}
          {activeTab === 'tax' && (
            <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-zinc-100 pb-4">
                <h2 className="text-base font-bold text-zinc-900">Operating Currency, Timezone & Tax</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Configure default monetary standards, schedule timezones, and regional tax identification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Operating Currency */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="currency" className="block text-xs font-semibold text-zinc-700">
                      Operating Currency <span className="text-rose-500">*</span>
                    </label>
                    {profile.countryCode === 'LK' && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        LKR Recommended
                      </span>
                    )}
                  </div>
                  <select
                    id="currency"
                    required
                    disabled={!canEdit}
                    value={profile.currency}
                    onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
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
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Standard monetary unit used across billing, financial reporting, and operations.
                  </p>
                </div>

                {/* Operating Timezone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="timezone" className="block text-xs font-semibold text-zinc-700">
                      Operating Timezone <span className="text-rose-500">*</span>
                    </label>
                    {profile.countryCode === 'LK' && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        Asia/Colombo Recommended
                      </span>
                    )}
                  </div>
                  <select
                    id="timezone"
                    required
                    disabled={!canEdit}
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
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
                  <p className="text-[11px] text-zinc-400 mt-1">
                    System logs, scheduling, and shifts synchronize against this timezone.
                  </p>
                </div>

                {/* Tax / VAT Identification */}
                <div>
                  <label htmlFor="taxId" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Tax / VAT Identification Number (TIN / GST / EIN)
                  </label>
                  <input
                    id="taxId"
                    type="text"
                    disabled={!canEdit}
                    value={profile.taxId}
                    onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
                    placeholder="e.g. VAT-123456789 / TIN-987654"
                  />
                  {fieldErrors.taxId && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.taxId}</p>
                  )}
                </div>

                {/* Tax Registration Scheme */}
                <div>
                  <label htmlFor="taxStatus" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Regional Tax Scheme / Status
                  </label>
                  <select
                    id="taxStatus"
                    disabled={!canEdit}
                    value={profile.taxStatus}
                    onChange={(e) => setProfile({ ...profile, taxStatus: e.target.value })}
                    className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 capitalize"
                  >
                    <option value="standard">Standard Business Tax Status</option>
                    <option value="vat_registered">Registered for VAT / GST</option>
                    <option value="exempt">Tax-Exempt Entity</option>
                    <option value="simplified">Simplified / Small Enterprise Scheme</option>
                  </select>
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving Configuration...' : 'Save Configuration'}</span>
              </button>
            </div>
          )}
        </form>
      ) : (
        /* TAB 4: Headquarters Operating Branch */
        <form onSubmit={handleSaveBranch} className="space-y-6">
          <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-zinc-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Headquarters Operating Branch</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Primary business facility provisioned during initial workspace registration.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Primary Facility
                </span>
                {initialData.headquartersBranch?.isOwnerAssigned && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Owner Linked
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Branch Name */}
              <div>
                <label htmlFor="branchName" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Operating Branch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="branchName"
                  type="text"
                  required
                  disabled={!canEdit}
                  value={branch.name}
                  onChange={(e) => setBranch({ ...branch, name: e.target.value })}
                  className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                  placeholder="Headquarters"
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Branch Code */}
              <div>
                <label htmlFor="branchCode" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Branch Code / Identifier
                </label>
                <input
                  id="branchCode"
                  type="text"
                  disabled={!canEdit}
                  value={branch.code}
                  onChange={(e) => setBranch({ ...branch, code: e.target.value })}
                  className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
                  placeholder="HQ"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Short code used for inventory, documents, and branch receipts.
                </p>
              </div>

              {/* Branch Phone */}
              <div>
                <label htmlFor="branchPhone" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Direct Facility Phone
                </label>
                <input
                  id="branchPhone"
                  type="tel"
                  disabled={!canEdit}
                  value={branch.contactPhone}
                  onChange={(e) => setBranch({ ...branch, contactPhone: e.target.value })}
                  className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Branch Email */}
              <div>
                <label htmlFor="branchEmail" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Direct Facility Email
                </label>
                <input
                  id="branchEmail"
                  type="email"
                  disabled={!canEdit}
                  value={branch.contactEmail}
                  onChange={(e) => setBranch({ ...branch, contactEmail: e.target.value })}
                  className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                  placeholder="hq@yourcompany.com"
                />
              </div>

              {/* Physical Address */}
              <div className="md:col-span-2 pt-3 border-t border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-4">
                  Physical Operating Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label htmlFor="bAddressLine1" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Physical Street Address
                    </label>
                    <input
                      id="bAddressLine1"
                      type="text"
                      disabled={!canEdit}
                      value={branch.addressLine1}
                      onChange={(e) => setBranch({ ...branch, addressLine1: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="e.g. 100 Commercial Avenue"
                    />
                  </div>

                  <div>
                    <label htmlFor="bCity" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      City
                    </label>
                    <input
                      id="bCity"
                      type="text"
                      disabled={!canEdit}
                      value={branch.city}
                      onChange={(e) => setBranch({ ...branch, city: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label htmlFor="bPostalCode" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Postal Code
                    </label>
                    <input
                      id="bPostalCode"
                      type="text"
                      disabled={!canEdit}
                      value={branch.postalCode}
                      onChange={(e) => setBranch({ ...branch, postalCode: e.target.value })}
                      className="w-full text-xs rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500 font-mono"
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingBranch ? 'Saving Branch...' : 'Save Headquarters Information'}</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
