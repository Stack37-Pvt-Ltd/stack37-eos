import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { sanitizeRedirectPath } from '../../../lib/validations/auth';
import { createRecoveryToken, RECOVERY_COOKIE_NAME } from '../../../lib/auth/recovery-token';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Route Handler processing Supabase Auth callbacks.
 * Supports:
 * 1. Standard PKCE authorization code exchange (`code`)
 * 2. Token hash email verification (`token_hash` + `type`)
 * 
 * Password Recovery Security Invariant:
 * Recovery authorization is NEVER derived from user-controlled query parameters.
 * It is issued ONLY when Supabase Auth cryptographically confirms a verified recovery event
 * (either verifyOtp with type='recovery' or PKCE exchange with redirectType='recovery').
 * The issued cookie is tamper-resistant (HMAC signed), time-limited (15m), and bound to the user ID.
 * 
 * Open-Redirect Defense:
 * The `next` destination parameter is strictly sanitized via `sanitizeRedirectPath`.
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
  const createAuthorizedResponse = (destination: string, recoveryUserId?: string) => {
    const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
    if (recoveryUserId) {
      // Issue cryptographically signed, user-bound, time-limited recovery authorization
      const token = createRecoveryToken(recoveryUserId, 900);
      response.cookies.set(RECOVERY_COOKIE_NAME, token, {
        path: '/',
        maxAge: 900,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return response;
  };

  // Scenario 1: PKCE Code Exchange
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      // GoTrue returns redirectType === 'recovery' for verified recovery PKCE exchanges
      const isVerifiedRecovery = (data as { redirectType?: string }).redirectType === 'recovery';
      return createAuthorizedResponse(safeNext, isVerifiedRecovery ? data.user.id : undefined);
    }
  }

  // Scenario 2: Token Hash OTP Verification (Email Confirmation / Recovery)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data?.user) {
      // Token hash cryptographically verified by Supabase server specifically for recovery
      const isVerifiedRecovery = type === 'recovery';
      return createAuthorizedResponse(safeNext, isVerifiedRecovery ? data.user.id : undefined);
    }
  }

  // If callback validation fails or no valid parameters were supplied,
  // redirect safely to /login with a sanitized error indicator.
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', requestUrl.origin)
  );
}
