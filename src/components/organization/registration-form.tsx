'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import {
  createBusinessAction,
  type OrganizationActionResult,
  type CreateBusinessResult,
} from '../../lib/actions/organization';
import {
  formatSlugSuggestion,
  SLUG_REGEX,
  RESERVED_SLUGS,
} from '../../lib/validations/organization';
import { Building2, ShieldCheck, UserCircle, ArrowRight } from 'lucide-react';

const COMMON_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
];

export interface RegistrationFormProps {
  userEmail?: string;
}

export function RegistrationForm({ userEmail }: RegistrationFormProps) {
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [countryCode, setCountryCode] = React.useState('US');

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [registeredOrg, setRegisteredOrg] = React.useState<CreateBusinessResult | null>(null);

  // In-flight submission lock to prevent concurrent double-clicks
  const isSubmittingRef = React.useRef(false);

  // Auto-generate slug when name changes, unless user manually customized it
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextName = e.target.value;
    setName(nextName);

    if (!isSlugManuallyEdited) {
      setSlug(formatSlugSuggestion(nextName));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setSlug(e.target.value.toLowerCase().trim());
  };

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (name.trim().length < 2) {
      errors.name = 'Business name must be at least 2 characters long.';
    }

    if (slug.length < 3) {
      errors.slug = 'Workspace URL must be at least 3 characters long.';
    } else if (slug.length > 63) {
      errors.slug = 'Workspace URL cannot exceed 63 characters.';
    } else if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.slug = 'Workspace URL cannot begin or end with a hyphen.';
    } else if (slug.includes('--')) {
      errors.slug = 'Workspace URL cannot contain consecutive hyphens.';
    } else if (!SLUG_REGEX.test(slug)) {
      errors.slug = 'Workspace URL can only contain lowercase letters, numbers, and single hyphens.';
    } else if (RESERVED_SLUGS.has(slug)) {
      errors.slug = 'This workspace URL is reserved. Please choose another name.';
    }

    if (!countryCode || countryCode.length !== 2) {
      errors.countryCode = 'Please select a valid country.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || isLoading) {
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});

    if (!validateClientSide()) {
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const res: OrganizationActionResult<CreateBusinessResult> = await createBusinessAction({
        name,
        slug,
        countryCode,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to register business workspace. Please try again.');
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else if (res.data) {
        setRegisteredOrg(res.data);
      }
    } catch {
      setErrorMessage('A network error occurred while registering your business. Please try again.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  if (registeredOrg) {
    return (
      <Card className="border-zinc-200/80 shadow-xs">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-center">Business Workspace Created</CardTitle>
          <CardDescription className="text-center">
            <strong>{name}</strong> has been successfully registered. You are designated as the primary owner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-4 text-xs space-y-2 text-zinc-600">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Workspace Identifier:</span>
              <span className="font-mono font-semibold text-zinc-900">{registeredOrg.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Primary Owner:</span>
              <span className="font-semibold text-zinc-900 truncate max-w-[200px]">{userEmail || 'Active Account'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Subscription Tier:</span>
              <span className="text-emerald-700 font-semibold uppercase text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                {registeredOrg.planName || 'Standard'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Trial Duration:</span>
              <span className="font-semibold text-zinc-900">7 Days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Payment Method:</span>
              <span className="text-zinc-500">None Required for Trial</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-center leading-relaxed">
            Your host-only session is established on this portal. Return to your workspace selector to access all active organizations.
          </p>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => router.push('/select-organization')}
          >
            <span>Proceed to Workspace Selection</span>
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200/80 shadow-xs">
      <CardHeader>
        <CardTitle>Register Business Workspace</CardTitle>
        <CardDescription>
          Establish your organization to begin managing multi-tenant operations. All new workspaces include a 7-day free trial.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="error" className="mb-2">
              {errorMessage}
            </Alert>
          )}

          <div className="space-y-1">
            <Input
              id="businessName"
              label="Business Name"
              type="text"
              placeholder="e.g. Acme Corporation"
              value={name}
              onChange={handleNameChange}
              error={fieldErrors.name}
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="slug" className="block text-xs font-semibold text-zinc-700">
              Workspace URL Subdomain
            </label>
            <div className="flex rounded-lg shadow-2xs border border-zinc-200/80 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-zinc-900 bg-white overflow-hidden">
              <span className="inline-flex items-center px-3 text-xs text-zinc-400 bg-zinc-50 border-r border-zinc-200/60 select-none">
                https://
              </span>
              <input
                id="slug"
                type="text"
                className="block w-full min-w-0 flex-1 border-0 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:ring-0 font-mono"
                placeholder="acme-corp"
                value={slug}
                onChange={handleSlugChange}
                disabled={isLoading}
                required
              />
              <span className="inline-flex items-center px-3 text-xs text-zinc-500 bg-zinc-50 border-l border-zinc-200/60 select-none font-mono">
                .stack37.com
              </span>
            </div>
            {fieldErrors.slug && (
              <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.slug}</p>
            )}
            <p className="text-[11px] text-zinc-400 leading-tight">
              3 to 63 lowercase alphanumeric characters and single hyphens.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="countryCode" className="block text-xs font-semibold text-zinc-700">
              Country of Incorporation / Operation
            </label>
            <div className="relative">
              <select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
              >
                {COMMON_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.countryCode && (
              <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.countryCode}</p>
            )}
          </div>

          {userEmail && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <UserCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="text-zinc-500 truncate">Primary Owner:</span>
                <span className="font-semibold text-zinc-800 truncate">{userEmail}</span>
              </div>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 shrink-0">
                Owner
              </span>
            </div>
          )}

          <div className="rounded-lg bg-zinc-50/80 border border-zinc-200/60 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-zinc-700 font-medium">7-Day Free Trial</span>
            </div>
            <span className="text-[11px] text-zinc-500">No payment details required</span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-2"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Create Workspace (Start 7-Day Trial)
          </Button>
        </CardContent>

        <CardFooter className="justify-center border-t border-zinc-100 pt-3">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span>Multi-Tenant Isolation Protection • My Business by STACK37</span>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
