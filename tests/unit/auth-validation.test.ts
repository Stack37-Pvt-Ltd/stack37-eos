import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sanitizeRedirectPath,
} from '../../src/lib/validations/auth';

describe('Authentication Validation Schemas', () => {
  describe('emailSchema', () => {
    it('accepts valid email addresses and normalizes case/whitespace', () => {
      const result = emailSchema.safeParse('  User@Example.COM ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = ['', '   ', 'not-an-email', '@missinguser.com', 'user@.com', 'user@domain'];
      for (const email of invalidEmails) {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('passwordSchema', () => {
    it('accepts enterprise-grade complex passwords', () => {
      const valid = ['P@ssw0rd2026', 'Strong#Pass123', 'X!9yZ#12aB$'];
      for (const pass of valid) {
        const result = passwordSchema.safeParse(pass);
        expect(result.success).toBe(true);
      }
    });

    it('rejects passwords shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('P@s12');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 8 characters');
      }
    });

    it('rejects passwords missing required character classes', () => {
      expect(passwordSchema.safeParse('nouppercase123!').success).toBe(false);
      expect(passwordSchema.safeParse('NOLOWERCASE123!').success).toBe(false);
      expect(passwordSchema.safeParse('NoNumbersHere!!').success).toBe(false);
      expect(passwordSchema.safeParse('NoSpecialChars123').success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('accepts valid signup payload with matching passwords', () => {
      const result = signupSchema.safeParse({
        fullName: 'Jane Doe',
        email: 'jane@business.com',
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when confirmPassword does not match', () => {
      const result = signupSchema.safeParse({
        fullName: 'Jane Doe',
        email: 'jane@business.com',
        password: 'ValidPassword123!',
        confirmPassword: 'MismatchedPassword123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('confirmPassword'));
        expect(issue?.message).toBe('Passwords do not match.');
      }
    });

    it('rejects short full name', () => {
      const result = signupSchema.safeParse({
        fullName: 'J',
        email: 'jane@business.com',
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login credentials', () => {
      const result = loginSchema.safeParse({
        email: 'admin@stack37.com',
        password: 'AnyPasswordProvided',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'admin@stack37.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema and resetPasswordSchema', () => {
    it('validates forgot password input', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
      expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
    });

    it('validates reset password confirmation match', () => {
      expect(
        resetPasswordSchema.safeParse({
          password: 'NewStrongPassword123!',
          confirmPassword: 'NewStrongPassword123!',
        }).success
      ).toBe(true);

      expect(
        resetPasswordSchema.safeParse({
          password: 'NewStrongPassword123!',
          confirmPassword: 'WrongPassword!',
        }).success
      ).toBe(false);
    });
  });

  describe('sanitizeRedirectPath', () => {
    it('permits safe relative paths', () => {
      expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
      expect(sanitizeRedirectPath('/select-organization?tab=active#details')).toBe(
        '/select-organization?tab=active#details'
      );
      expect(sanitizeRedirectPath('/tenant/acme/settings')).toBe('/tenant/acme/settings');
    });

    it('discards protocol-relative URLs', () => {
      expect(sanitizeRedirectPath('//attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('///attacker.com/evil')).toBe('/dashboard');
    });

    it('discards absolute external URLs', () => {
      expect(sanitizeRedirectPath('https://attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('http://evil.com/login')).toBe('/dashboard');
    });

    it('discards backslash injection attacks', () => {
      expect(sanitizeRedirectPath('/\\attacker.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('\\dashboard')).toBe('/dashboard');
    });

    it('falls back safely for null, undefined, or empty values', () => {
      expect(sanitizeRedirectPath(null)).toBe('/dashboard');
      expect(sanitizeRedirectPath(undefined)).toBe('/dashboard');
      expect(sanitizeRedirectPath('')).toBe('/dashboard');
      expect(sanitizeRedirectPath(null, '/login')).toBe('/login');
    });

    it('discards paths containing newline or carriage return escapes', () => {
      expect(sanitizeRedirectPath('/dashboard\r\nSet-Cookie: evil=1')).toBe('/dashboard');
    });
  });
});
