import { describe, it, expect } from 'vitest';
import {
  createBusinessSchema,
  businessSlugSchema,
  formatSlugSuggestion,
  RESERVED_SLUGS,
  SLUG_REGEX,
} from '../../src/lib/validations/organization';

describe('Organization Validation & Slug Invariants', () => {
  describe('formatSlugSuggestion', () => {
    it('normalizes standard business names to URL-safe hyphenated slugs', () => {
      expect(formatSlugSuggestion('Acme Corporation')).toBe('acme-corporation');
      expect(formatSlugSuggestion('  Global Logistics Ltd.  ')).toBe('global-logistics-ltd');
      expect(formatSlugSuggestion('Tech & Innovations!')).toBe('tech-innovations');
    });

    it('collapses consecutive spaces and special characters', () => {
      expect(formatSlugSuggestion('Foo --- Bar')).toBe('foo-bar');
      expect(formatSlugSuggestion('Alpha @#$ Beta')).toBe('alpha-beta');
    });

    it('removes leading and trailing hyphens', () => {
      expect(formatSlugSuggestion('-Leading Hyphen')).toBe('leading-hyphen');
      expect(formatSlugSuggestion('Trailing Hyphen-')).toBe('trailing-hyphen');
      expect(formatSlugSuggestion('---Multiple Hyphens---')).toBe('multiple-hyphens');
    });

    it('truncates slugs exceeding 63 characters', () => {
      const longName = 'A'.repeat(80);
      const slug = formatSlugSuggestion(longName);
      expect(slug.length).toBeLessThanOrEqual(63);
    });
  });

  describe('businessSlugSchema', () => {
    it('accepts valid alphanumeric slugs matching database check constraint', () => {
      const validSlugs = [
        'acme',
        'acme-corp',
        'alpha-123',
        'global-retail-hub',
        'b2b-market',
        'store-99',
        'test',
      ];

      for (const slug of validSlugs) {
        const result = businessSlugSchema.safeParse(slug);
        expect(result.success, `Expected "${slug}" to be valid`).toBe(true);
        expect(SLUG_REGEX.test(slug)).toBe(true);
      }
    });

    it('rejects slugs shorter than 3 characters', () => {
      expect(businessSlugSchema.safeParse('a').success).toBe(false);
      expect(businessSlugSchema.safeParse('ab').success).toBe(false);
    });

    it('rejects slugs longer than 63 characters', () => {
      const tooLong = 'a' + 'b'.repeat(63);
      expect(businessSlugSchema.safeParse(tooLong).success).toBe(false);
    });

    it('rejects slugs with leading or trailing hyphens', () => {
      const leading = businessSlugSchema.safeParse('-acme');
      expect(leading.success).toBe(false);
      if (!leading.success) {
        expect(leading.error.issues[0]?.message).toContain('cannot begin or end with a hyphen');
      }

      const trailing = businessSlugSchema.safeParse('acme-');
      expect(trailing.success).toBe(false);
      if (!trailing.success) {
        expect(trailing.error.issues[0]?.message).toContain('cannot begin or end with a hyphen');
      }
    });

    it('rejects slugs containing consecutive hyphens', () => {
      const result = businessSlugSchema.safeParse('acme--corp');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('consecutive hyphens');
      }
    });

    it('rejects slugs containing uppercase letters or invalid punctuation', () => {
      expect(businessSlugSchema.safeParse('Acme-Corp').success).toBe(false);
      expect(businessSlugSchema.safeParse('acme_corp').success).toBe(false);
      expect(businessSlugSchema.safeParse('acme.corp').success).toBe(false);
    });

    it('rejects database-reserved slugs', () => {
      const dbReserved = ['admin', 'api', 'app', 'auth', 'billing', 'support', 'www', 'mybusiness'];

      for (const reserved of dbReserved) {
        expect(RESERVED_SLUGS.has(reserved)).toBe(true);
        const result = businessSlugSchema.safeParse(reserved);
        expect(result.success, `Expected reserved slug "${reserved}" to be rejected`).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('reserved');
        }
      }
    });
  });

  describe('createBusinessSchema', () => {
    it('validates a complete, compliant business registration payload', () => {
      const payload = {
        name: 'Acme International',
        slug: 'acme-international',
        countryCode: 'US',
      };

      const result = createBusinessSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects empty or whitespace business names', () => {
      const payload = {
        name: '   ',
        slug: 'valid-slug',
        countryCode: 'US',
      };

      const result = createBusinessSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true);
      }
    });

    it('rejects invalid country codes', () => {
      const invalidCountries = ['USA', 'u', '12', 'GBR', ''];

      for (const countryCode of invalidCountries) {
        const result = createBusinessSchema.safeParse({
          name: 'Valid Name',
          slug: 'valid-slug',
          countryCode,
        });
        expect(result.success, `Expected country code "${countryCode}" to be rejected`).toBe(false);
      }
    });
  });
});
