import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { sanitizeRedirectPath } from '../../../lib/validations/auth';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Route Handler processing Supabase Auth callbacks.
 * Supports:
 * 1. Standard PKCE authorization code exchange (`code`)
 * 2. Token hash email verification (`token_hash` + `type`)
 * 
 * Open-Redirect Defense:
 * The `next` destination parameter is strictly sanitized via `sanitizeRedirectPath`.
 * Unsafe external or protocol-relative targets are automatically discarded.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const rawNext = requestUrl.searchParams.get('next');

  // Enforce strict local relative redirect sanitization
  const safeNext = sanitizeRedirectPath(rawNext, '/select-organization');

  const supabase = await createClient();

  // Helper to construct authorized redirect response
  const createAuthorizedResponse = (destination: string, isRecovery: boolean) => {
    const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
    if (isRecovery) {
      // Issue short-lived recovery authorization (15 minutes) for password-reset verification
      response.cookies.set('sb-recovery-mode', 'true', {
        path: '/',
        maxAge: 900,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return response;
  };

  const isRecoveryFlow = type === 'recovery' || safeNext.includes('/reset-password');

  // Scenario 1: PKCE Code Exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return createAuthorizedResponse(safeNext, isRecoveryFlow);
    }
  }

  // Scenario 2: Token Hash OTP Verification (Email Confirmation / Recovery)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return createAuthorizedResponse(safeNext, isRecoveryFlow);
    }
  }

  // If callback validation fails or no valid parameters were supplied,
  // redirect safely to /login with a sanitized error indicator.
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', requestUrl.origin)
  );
}
