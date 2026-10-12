'use server';

import { createClient } from '../supabase/server';
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sanitizeRedirectPath,
  LoginInput,
  SignupInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validations/auth';
import { headers, cookies } from 'next/headers';
import { createRecoveryToken, verifyRecoveryToken, RECOVERY_COOKIE_NAME } from '../auth/recovery-token';
import { isApprovedCallbackHost } from '../auth/host';
import type { EmailOtpType } from '@supabase/supabase-js';

export interface AuthActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  emailConfirmationRequired?: boolean;
}

/**
 * Resolves the trusted origin dynamically from incoming request headers.
 */
async function getTrustedOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Authenticates an existing user via Supabase Auth with signInWithPassword.
 */
export async function loginAction(
  rawInput: LoginInput
): Promise<AuthActionResult<{ userId: string; email: string }>> {
  const validation = loginSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      error: 'Please correct the errors in the form.',
      fieldErrors,
    };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Sanitized error: do not expose internal DB errors or distinguish between
    // invalid password vs non-existent user to prevent enumeration.
    return {
      success: false,
      error: 'Invalid email address or password.',
    };
  }

  return {
    success: true,
    data: {
      userId: data.user.id,
      email: data.user.email || email,
    },
  };
}

/**
 * Registers a new user identity in Supabase Auth.
 * Handles both immediate session issuance and email confirmation flows cleanly.
 * Anti-Enumeration Defense: Does not reveal whether an account already exists.
 */
export async function signupAction(
  rawInput: SignupInput
): Promise<AuthActionResult<{ userId: string; email: string }>> {
  const validation = signupSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      error: 'Please correct the errors in the form.',
      fieldErrors,
    };
  }

  const { fullName, email, password } = validation.data;
  const origin = await getTrustedOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/select-organization`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    // Anti-Enumeration Defense:
    // Do not reveal whether an account already exists for this email address.
    const sanitizedError =
      error.status === 429
        ? 'Too many signup attempts. Please try again later.'
        : 'Registration could not be completed. Please check your details or try signing in.';

    return {
      success: false,
      error: sanitizedError,
    };
  }

  if (!data.user) {
    return {
      success: false,
      error: 'An unexpected error occurred during signup. Please try again.',
    };
  }

  // When email confirmation is enabled, Supabase returns a user record with session: null
  const emailConfirmationRequired = data.session === null;

  return {
    success: true,
    emailConfirmationRequired,
    data: {
      userId: data.user.id,
      email: data.user.email || email,
    },
  };
}

/**
 * Initiates the password recovery workflow by dispatching a reset email.
 * Always returns a generic success notice to eliminate user enumeration vectors.
 */
export async function forgotPasswordAction(
  rawInput: ForgotPasswordInput
): Promise<AuthActionResult<{ message: string }>> {
  const validation = forgotPasswordSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: 'Please enter a valid email address.',
    };
  }

  const { email } = validation.data;
  const origin = await getTrustedOrigin();
  const supabase = await createClient();

  // Dispatches password recovery email.
  // The Supabase email template directs the user to the intermediate confirmation page:
  // {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
  // GET requests do not consume the single-use token.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  // Always return identical success notice regardless of account existence
  return {
    success: true,
    data: {
      message: 'If an account exists with this email address, a password reset link has been dispatched.',
    },
  };
}

/**
 * Updates the user's password during an active recovery session.
 * Enforces explicit recovery authorization (sb-recovery-mode cookie issued by callback).
 * An ordinary authenticated session alone cannot execute password reset.
 */
export async function resetPasswordAction(
  rawInput: ResetPasswordInput
): Promise<AuthActionResult<{ message: string }>> {
  const validation = resetPasswordSchema.safeParse(rawInput);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0]?.toString() || 'form';
      fieldErrors[field] = issue.message;
    }
    const isMismatch = validation.error.issues.some((i) => i.message === 'Passwords do not match.');
    return {
      success: false,
      error: isMismatch ? 'Passwords do not match.' : 'Please correct the errors in the form.',
      fieldErrors,
    };
  }

  const { password } = validation.data;
  const cookieStore = await cookies();
  const rawRecoveryToken = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;

  const supabase = await createClient();

  // Verify server-side that a cryptographically verified user session exists
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'Password reset session is invalid or has expired. Please request a new link.',
    };
  }

  // Security Invariant: An authenticated session alone does not prove password recovery.
  // Validate that a genuine, tamper-resistant, time-limited recovery token was issued for this user.
  const isRecoveryAuthorized = verifyRecoveryToken(rawRecoveryToken, user.id);
  if (!isRecoveryAuthorized) {
    return {
      success: false,
      error: 'Unauthorized: Password reset requires a verified recovery session from your email link.',
    };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    const errCode = (error as { code?: string }).code;
    const errMessage = (error as { message?: string }).message || '';

    if (
      errCode === 'same_password' ||
      errMessage.toLowerCase().includes('same password') ||
      errMessage.toLowerCase().includes('different from the old') ||
      errMessage.toLowerCase().includes('different from your current')
    ) {
      const samePasswordMsg = 'Your new password must be different from your current password.';
      return {
        success: false,
        error: samePasswordMsg,
        fieldErrors: {
          password: samePasswordMsg,
        },
      };
    }

    if (
      errCode === 'weak_password' ||
      errMessage.toLowerCase().includes('weak') ||
      errMessage.toLowerCase().includes('pwned')
    ) {
      const weakPasswordMsg = errMessage || 'The password provided is too weak. Please choose a stronger password.';
      return {
        success: false,
        error: weakPasswordMsg,
        fieldErrors: {
          password: weakPasswordMsg,
        },
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to update password. Please ensure it meets complexity requirements and try again.',
    };
  }

  // Clear recovery mode authorization upon successful password reset
  cookieStore.delete(RECOVERY_COOKIE_NAME);

  return {
    success: true,
    data: {
      message: 'Password successfully updated. You may now sign in with your new credentials.',
    },
  };
}

/**
 * Signs the user out.
 * 
 * Scope:
 * - 'local' (default): Clears the session on the current browser/device.
 * - 'global': Revokes refresh tokens globally across all devices/sessions on the Supabase Auth server.
 */
export async function logoutAction(
  options?: { scope?: 'local' | 'global' }
): Promise<AuthActionResult> {
  const supabase = await createClient();
  const scope = options?.scope === 'global' ? 'global' : 'local';

  const { error } = await supabase.auth.signOut({ scope });

  if (error) {
    return {
      success: false,
      error: 'Failed to log out. Please try again.',
    };
  }

  return {
    success: true,
  };
}

export interface ConfirmOtpInput {
  tokenHash: string;
  type: EmailOtpType;
  next?: string;
}

/**
 * Confirms email verification or password recovery OTP token server-side upon deliberate user action.
 * 
 * Security Invariants:
 * 1. Single-use token is NEVER consumed upon automated GET crawler inspection.
 * 2. Host validation: strictly enforces approved EOS host origins.
 * 3. Token-Type validation: only permits whitelisted email OTP types.
 * 4. Open-Redirect immunity: strictly sanitizes the 'next' parameter.
 * 5. Recovery session authorization: strictly issues a cryptographic 15-minute sb-recovery-token
 *    cookie bound to the verified user ID only when type='recovery'.
 * 6. Preserves host-only session cookie architecture.
 */
export async function confirmOtpAction(
  input: ConfirmOtpInput
): Promise<AuthActionResult<{ redirectTo: string }>> {
  const headerList = await headers();
  const host = headerList.get('host') || '';

  // 1. Host Validation
  if (!isApprovedCallbackHost(host)) {
    return {
      success: false,
      error: 'Bad Request: Invalid confirmation host origin.',
    };
  }

  const { tokenHash, type, next } = input;

  // 2. Validate token hash presence
  if (!tokenHash || typeof tokenHash !== 'string' || tokenHash.trim() === '') {
    return {
      success: false,
      error: 'Invalid or missing confirmation token.',
    };
  }

  // 3. Validate token type
  const validTypes: EmailOtpType[] = ['email', 'signup', 'recovery', 'invite', 'magiclink'];
  if (!type || !validTypes.includes(type)) {
    return {
      success: false,
      error: 'Invalid verification token type.',
    };
  }

  // 4. Safe destination sanitization
  const defaultDestination = type === 'recovery' ? '/reset-password' : '/select-organization';
  const safeDestination = sanitizeRedirectPath(next, defaultDestination);

  // 5. Verify token server-side via Supabase GoTrue
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user) {
    return {
      success: false,
      error: 'The verification link is invalid or has expired. Please request a new one.',
    };
  }

  // 6. Recovery session authorization
  if (type === 'recovery') {
    const cookieStore = await cookies();
    const recoveryToken = createRecoveryToken(data.user.id, 900);
    cookieStore.set(RECOVERY_COOKIE_NAME, recoveryToken, {
      path: '/',
      maxAge: 900,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return {
    success: true,
    data: {
      redirectTo: safeDestination,
    },
  };
}
