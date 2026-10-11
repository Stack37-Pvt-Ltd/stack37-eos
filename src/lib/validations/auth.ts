import { z } from 'zod';

/**
 * Strict RFC-compliant email schema with normalization.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: 'Email address is required.' })
  .email({ message: 'Please enter a valid email address.' })
  .max(255, { message: 'Email address cannot exceed 255 characters.' });

/**
 * Strong password schema enforcing enterprise complexity:
 * - Minimum 8 characters, maximum 128 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special symbol
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long.' })
  .max(128, { message: 'Password cannot exceed 128 characters.' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
  .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character.' });

/**
 * Schema for user login.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .max(128, { message: 'Password cannot exceed 128 characters.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schema for initial user identity registration.
 */
export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: 'Full name must be at least 2 characters long.' })
      .max(100, { message: 'Full name cannot exceed 100 characters.' }),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for requesting a password reset email.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema for setting a new password during recovery.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Validates and sanitizes a redirect URL to prevent open-redirect vulnerabilities.
 * 
 * Rules:
 * - Must start with a single '/'
 * - Must NOT start with '//' (rejects protocol-relative URLs)
 * - Must NOT contain backslashes or URL control escapes
 * - Only permits safe path, query, and fragment characters
 * 
 * If validation fails, falls back safely to defaultPath.
 */
export function sanitizeRedirectPath(
  target: string | null | undefined,
  defaultPath = '/dashboard'
): string {
  if (!target || typeof target !== 'string') {
    return defaultPath;
  }

  const trimmed = target.trim();

  // Reject protocol-relative (//example.com) and non-relative URLs
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return defaultPath;
  }

  // Reject paths containing carriage returns or newlines
  if (/[\r\n\0]/.test(trimmed)) {
    return defaultPath;
  }

  // Validate allowed URL characters: alphanumeric, /, -, _, ., ?, =, &, %, #, +
  const safeRelativePathRegex = /^\/[a-zA-Z0-9_\-\.\/\?=&%#+]*$/;
  if (!safeRelativePathRegex.test(trimmed)) {
    return defaultPath;
  }

  return trimmed;
}
