'use server';

import { createClient } from '../supabase/server';
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  LoginInput,
  SignupInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validations/auth';
import { headers } from 'next/headers';

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
      emailRedirectTo: `${origin}/auth/callback?next=/select-organization`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    // Return sanitized message, catching duplicate emails or rate limits without leaking system internals
    const sanitizedError =
      error.status === 429
        ? 'Too many signup attempts. Please try again later.'
        : error.message.toLowerCase().includes('already registered')
        ? 'An account with this email address already exists.'
        : 'Registration failed. Please check your details and try again.';

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

  // Send password recovery email directing to PKCE callback
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
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
    return {
      success: false,
      error: 'Please correct the errors in the form.',
      fieldErrors,
    };
  }

  const { password } = validation.data;
  const supabase = await createClient();

  // Verify server-side that a cryptographically verified user session exists
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'Password reset session is invalid or has expired. Please request a new link.',
    };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      success: false,
      error: 'Failed to update password. Please ensure it meets complexity requirements and try again.',
    };
  }

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
