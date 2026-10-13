import { z } from 'zod';

/**
 * Reserved subdomains that cannot be registered as an organization slug.
 * Strictly superset of database constraints in 20261010000002_02_core_tenancy.sql:
 * ('admin', 'api', 'app', 'auth', 'billing', 'support', 'www', 'mybusiness')
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'support',
  'www',
  'mybusiness',
  'portal',
  'status',
  'mail',
  'staging',
  'dev',
]);

/**
 * Normalizes an arbitrary business name into a URL-safe subdomain slug suggestion.
 * Trims, converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * removes consecutive hyphens, and trims leading/trailing hyphens.
 */
export function formatSlugSuggestion(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace spaces and special characters with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
    .replace(/-{2,}/g, '-') // Collapse consecutive hyphens
    .slice(0, 63); // Max slug length
}

/**
 * Database check constraint regex from organizations table:
 * slug ~ '^[a-z0-9](-?[a-z0-9]){1,61}[a-z0-9]$'
 * 
 * Rules:
 * - Must start with lowercase letter or number
 * - Must end with lowercase letter or number
 * - Contains 1 to 61 groups of optional single hyphen followed by alphanumeric
 * - Total length: 3 to 63 characters
 * - No consecutive hyphens allowed
 */
export const SLUG_REGEX = /^[a-z0-9](-?[a-z0-9]){1,61}[a-z0-9]$/;

export const businessSlugSchema = z
  .string()
  .trim()
  .min(3, { message: 'Workspace URL must be at least 3 characters long.' })
  .max(63, { message: 'Workspace URL cannot exceed 63 characters.' })
  .refine((slug) => slug === slug.toLowerCase(), {
    message: 'Workspace URL must only contain lowercase letters.',
  })
  .refine((slug) => !slug.startsWith('-') && !slug.endsWith('-'), {
    message: 'Workspace URL cannot begin or end with a hyphen.',
  })
  .refine((slug) => !slug.includes('--'), {
    message: 'Workspace URL cannot contain consecutive hyphens.',
  })
  .refine((slug) => SLUG_REGEX.test(slug), {
    message: 'Workspace URL can only contain lowercase letters, numbers, and single hyphens.',
  })
  .refine((slug) => !RESERVED_SLUGS.has(slug), {
    message: 'This workspace URL is reserved. Please choose another name.',
  });

export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Business name must be at least 2 characters long.' })
    .max(100, { message: 'Business name cannot exceed 100 characters.' }),
  slug: businessSlugSchema,
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { message: 'Please select a valid 2-letter country code.' }),
  categoryId: z
    .string()
    .trim()
    .uuid({ message: 'Invalid category selected.' })
    .optional()
    .or(z.literal('')),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'LKR', 'AUD', 'CAD', 'SGD', 'AED', 'INR', 'JPY', 'CHF', 'CNY', 'NZD'
] as const;

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Colombo',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export const TAX_STATUSES = [
  'standard',
  'vat_registered',
  'exempt',
  'simplified',
] as const;

export const updateBusinessConfigurationSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization identifier.' }),
  
  // Business Identity & Profile
  name: z
    .string()
    .trim()
    .min(2, { message: 'Business name must be at least 2 characters long.' })
    .max(100, { message: 'Business name cannot exceed 100 characters.' }),
  legalName: z
    .string()
    .trim()
    .max(150, { message: 'Legal business name cannot exceed 150 characters.' })
    .optional()
    .or(z.literal('')),
  registrationNumber: z
    .string()
    .trim()
    .max(50, { message: 'Registration number cannot exceed 50 characters.' })
    .optional()
    .or(z.literal('')),
  categoryId: z
    .string()
    .trim()
    .uuid({ message: 'Invalid business category selected.' })
    .optional()
    .or(z.literal('')),

  // Contact Information
  contactEmail: z
    .string()
    .trim()
    .email({ message: 'Please enter a valid email address.' })
    .optional()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .trim()
    .max(30, { message: 'Phone number cannot exceed 30 characters.' })
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .trim()
    .max(120, { message: 'Website URL cannot exceed 120 characters.' })
    .optional()
    .or(z.literal('')),

  // Registered Business Address
  addressLine1: z
    .string()
    .trim()
    .max(150, { message: 'Address line 1 cannot exceed 150 characters.' })
    .optional()
    .or(z.literal('')),
  addressLine2: z
    .string()
    .trim()
    .max(100, { message: 'Address line 2 cannot exceed 100 characters.' })
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(80, { message: 'City cannot exceed 80 characters.' })
    .optional()
    .or(z.literal('')),
  stateProvince: z
    .string()
    .trim()
    .max(80, { message: 'State/Province cannot exceed 80 characters.' })
    .optional()
    .or(z.literal('')),
  postalCode: z
    .string()
    .trim()
    .max(20, { message: 'Postal code cannot exceed 20 characters.' })
    .optional()
    .or(z.literal('')),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { message: 'Country code must be a 2-letter ISO code.' })
    .optional()
    .or(z.literal('')),

  // Localization & Operating Standards
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { message: 'Currency must be a 3-letter ISO code.' }),
  timezone: z
    .string()
    .trim()
    .min(1, { message: 'Please select an operating timezone.' })
    .max(60, { message: 'Invalid timezone name.' }),

  // Regional & Tax Information
  taxId: z
    .string()
    .trim()
    .max(50, { message: 'Tax ID / VAT number cannot exceed 50 characters.' })
    .optional()
    .or(z.literal('')),
  taxStatus: z
    .enum(TAX_STATUSES, { message: 'Please select a valid tax status.' })
    .default('standard'),
});

export type UpdateBusinessConfigurationInput = z.input<typeof updateBusinessConfigurationSchema>;

export const updateBranchConfigurationSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization identifier.' }),
  branchId: z.string().uuid({ message: 'Invalid branch identifier.' }),
  name: z
    .string()
    .trim()
    .min(2, { message: 'Branch name must be at least 2 characters long.' })
    .max(100, { message: 'Branch name cannot exceed 100 characters.' }),
  code: z
    .string()
    .trim()
    .min(1, { message: 'Branch code cannot be empty.' })
    .max(20, { message: 'Branch code cannot exceed 20 characters.' })
    .default('HQ'),
  contactEmail: z
    .string()
    .trim()
    .email({ message: 'Please enter a valid branch email.' })
    .optional()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .trim()
    .max(30, { message: 'Branch phone number cannot exceed 30 characters.' })
    .optional()
    .or(z.literal('')),
  addressLine1: z
    .string()
    .trim()
    .max(150, { message: 'Branch address cannot exceed 150 characters.' })
    .optional()
    .or(z.literal('')),
  addressLine2: z
    .string()
    .trim()
    .max(100, { message: 'Branch address line 2 cannot exceed 100 characters.' })
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(80, { message: 'City cannot exceed 80 characters.' })
    .optional()
    .or(z.literal('')),
  stateProvince: z
    .string()
    .trim()
    .max(80, { message: 'State/Province cannot exceed 80 characters.' })
    .optional()
    .or(z.literal('')),
  postalCode: z
    .string()
    .trim()
    .max(20, { message: 'Postal code cannot exceed 20 characters.' })
    .optional()
    .or(z.literal('')),
});

export type UpdateBranchConfigurationInput = z.input<typeof updateBranchConfigurationSchema>;

