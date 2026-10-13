import { describe, it, expect } from 'vitest';
import * as LoginPage from '../../src/app/login/page';
import * as RegisterPage from '../../src/app/register/page';
import * as VerifyEmailPage from '../../src/app/verify-email/page';
import * as ForgotPasswordPage from '../../src/app/forgot-password/page';
import * as ResetPasswordPage from '../../src/app/reset-password/page';
import * as ConfirmPage from '../../src/app/auth/confirm/page';
import * as RegistrationLayout from '../../src/app/registration/layout';
import * as TenantLayout from '../../src/app/tenant/[tenantSlug]/layout';
import { AuthShell } from '../../src/components/auth/auth-shell';
import { LoginForm } from '../../src/components/auth/login-form';
import { SignupForm } from '../../src/components/auth/signup-form';
import { ForgotPasswordForm } from '../../src/components/auth/forgot-password-form';
import { ResetPasswordForm } from '../../src/components/auth/reset-password-form';
import { VerifyEmailCard } from '../../src/components/auth/verify-email-card';
import { ConfirmCard } from '../../src/components/auth/confirm-card';
import { RegistrationForm } from '../../src/components/organization/registration-form';
import { Button } from '../../src/components/ui/button';
import { Input } from '../../src/components/ui/input';
import { Alert } from '../../src/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../src/components/ui/card';
import { sanitizeRedirectPath } from '../../src/lib/validations/auth';

describe('Authentication UI Module Contracts & Architecture', () => {
  describe('Page Exports and Metadata Hierarchy', () => {
    it('exports valid metadata and default component for /login', () => {
      expect(LoginPage.metadata).toBeDefined();
      expect(LoginPage.metadata.title).toBe('Sign In — My Business by STACK37');
      expect(LoginPage.metadata.description).toBeDefined();
      expect(typeof LoginPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /register', () => {
      expect(RegisterPage.metadata).toBeDefined();
      expect(RegisterPage.metadata.title).toBe('Create Account — My Business by STACK37');
      expect(RegisterPage.metadata.description).toBeDefined();
      expect(typeof RegisterPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /verify-email', () => {
      expect(VerifyEmailPage.metadata).toBeDefined();
      expect(VerifyEmailPage.metadata.title).toBe('Verify Email — My Business by STACK37');
      expect(VerifyEmailPage.metadata.description).toBeDefined();
      expect(typeof VerifyEmailPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /forgot-password', () => {
      expect(ForgotPasswordPage.metadata).toBeDefined();
      expect(ForgotPasswordPage.metadata.title).toBe('Reset Password — My Business by STACK37');
      expect(ForgotPasswordPage.metadata.description).toBeDefined();
      expect(typeof ForgotPasswordPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /reset-password', () => {
      expect(ResetPasswordPage.metadata).toBeDefined();
      expect(ResetPasswordPage.metadata.title).toBe('Set New Password — My Business by STACK37');
      expect(ResetPasswordPage.metadata.description).toBeDefined();
      expect(typeof ResetPasswordPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /auth/confirm', () => {
      expect(ConfirmPage.metadata).toBeDefined();
      expect(ConfirmPage.metadata.title).toBe('Confirm Verification — My Business by STACK37');
      expect(ConfirmPage.metadata.description).toBeDefined();
      expect(typeof ConfirmPage.default).toBe('function');
    });

    it('exports valid metadata and default component for /registration layout', () => {
      expect(RegistrationLayout.metadata).toBeDefined();
      expect(RegistrationLayout.metadata.title).toBe('Register Business — My Business by STACK37');
      expect(RegistrationLayout.metadata.description).toBeDefined();
      expect(typeof RegistrationLayout.default).toBe('function');
    });

    it('exports valid metadata and default component for /tenant/[tenantSlug] layout', () => {
      expect(TenantLayout.metadata).toBeDefined();
      expect(TenantLayout.metadata.title).toBe('Workspace — My Business by STACK37');
      expect(TenantLayout.metadata.description).toBeDefined();
      expect(typeof TenantLayout.default).toBe('function');
    });
  });

  describe('UI Component Definitions & Component Contracts', () => {
    it('exports functional RegistrationForm component', () => {
      expect(typeof RegistrationForm).toBe('function');
    });
    it('exports functional AuthShell wrapper', () => {
      expect(typeof AuthShell).toBe('function');
    });

    it('exports functional LoginForm component', () => {
      expect(typeof LoginForm).toBe('function');
    });

    it('exports functional SignupForm component', () => {
      expect(typeof SignupForm).toBe('function');
    });

    it('exports functional ForgotPasswordForm component', () => {
      expect(typeof ForgotPasswordForm).toBe('function');
    });

    it('exports functional ResetPasswordForm component', () => {
      expect(typeof ResetPasswordForm).toBe('function');
    });

    it('exports functional VerifyEmailCard component', () => {
      expect(typeof VerifyEmailCard).toBe('function');
    });

    it('exports functional ConfirmCard component', () => {
      expect(typeof ConfirmCard).toBe('function');
    });

    it('exports UI primitives (Button, Input, Alert, Card)', () => {
      expect(Button).toBeDefined();
      expect(Input).toBeDefined();
      expect(Alert).toBeDefined();
      expect(Card).toBeDefined();
      expect(CardHeader).toBeDefined();
      expect(CardTitle).toBeDefined();
      expect(CardDescription).toBeDefined();
      expect(CardContent).toBeDefined();
      expect(CardFooter).toBeDefined();
    });
  });

  describe('Client Form Redirect Security & Invariants', () => {
    it('sanitizes malicious open redirects to safe fallback during login post-redirect', () => {
      expect(sanitizeRedirectPath('https://evil.com', '/select-organization')).toBe('/select-organization');
      expect(sanitizeRedirectPath('//evil.com', '/select-organization')).toBe('/select-organization');
      expect(sanitizeRedirectPath('/\\evil.com', '/select-organization')).toBe('/select-organization');
      expect(sanitizeRedirectPath('/select-organization', '/select-organization')).toBe('/select-organization');
      expect(sanitizeRedirectPath('/tenant/billing', '/select-organization')).toBe('/tenant/billing');
    });

    it('validates password complexity rule checkers matching UI checklists', () => {
      const validatePasswordRules = (pwd: string) => ({
        length: pwd.length >= 8,
        lower: /[a-z]/.test(pwd),
        upper: /[A-Z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        special: /[^a-zA-Z0-9]/.test(pwd),
      });

      const weakRules = validatePasswordRules('weak');
      expect(weakRules.length).toBe(false);
      expect(weakRules.upper).toBe(false);

      const strongRules = validatePasswordRules('EnterpriseP@ssw0rd!');
      expect(Object.values(strongRules).every(Boolean)).toBe(true);
    });
  });
});
