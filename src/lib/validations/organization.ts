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
