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
 * Password Recovery Security Invariants:
 * 1. Recovery authorization is NEVER derived from user-controlled query parameters.
 * 2. PKCE code exchange (`exchangeCodeForSession`) returns `AuthTokenResponse` ({ user, session })
 *    without `redirectType`, and is NEVER treated as proof of password recovery. Even if
 *    query parameters include `type=recovery`, code exchanges are treated as ordinary login callbacks.
 * 3. Recovery authorization is issued ONLY when Supabase Auth cryptographically confirms a verified
 *    recovery challenge via `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`.
 * 4. The issued recovery cookie is tamper-resistant (HMAC-SHA256 with dedicated server secret),
 *    strictly bound to the verified user ID, and short-lived (15 minutes).
 * 
 * Open-Redirect Defense:
 * The `next` destination parameter is strictly sanitized via `sanitizeRedirectPath`.
 */
/**
 * Validates whether the callback request host is an approved EOS host.
 * Prevents DNS rebinding and cross-site callback manipulation.
 */
function isApprovedCallbackHost(host: string): boolean {
  if (!host) return false;
  const cleanHost = host.split(':')[0].toLowerCase();

  // Local development / testing environments
  if (
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost.endsWith('.localhost')
  ) {
    return true;
  }

  // Production EOS hosts (mybusiness or tenant subdomains)
  if (cleanHost === 'mybusiness.stack37.com' || cleanHost.endsWith('.stack37.com')) {
    // Specifically block corporate website apex and reserved external subdomains
    if (cleanHost === 'stack37.com' || cleanHost === 'www.stack37.com') {
      return false;
    }
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host') || requestUrl.host;

  // Validate callback origin against approved EOS hosts
  if (!isApprovedCallbackHost(host)) {
    return new NextResponse('Bad Request: Invalid callback host', { status: 400 });
  }

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

  // Scenario 1: Token Hash OTP Verification (Documented Supabase SSR Recovery & Email Confirmation)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error && data?.user) {
      // Cryptographically verified by Supabase Auth server specifically for password recovery
      const isVerifiedRecovery = type === 'recovery';
      return createAuthorizedResponse(safeNext, isVerifiedRecovery ? data.user.id : undefined);
    }

    // If OTP verification fails (invalid, expired, or forged token_hash), fail safely
    return NextResponse.redirect(
      new URL('/login?error=auth_callback_failed', requestUrl.origin)
    );
  }

  // Scenario 2: Standard PKCE Authorization Code Exchange (OAuth / SSO / Magic Link)
  // Security Note: AuthTokenResponse does not expose redirectType and is never used as proof of password recovery.
  // Ordinary login callbacks establish user sessions but NEVER grant recovery authorization.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      return createAuthorizedResponse(safeNext);
    }

    // Code exchange failed (expired, invalid, or replayed authorization code)
    return NextResponse.redirect(
      new URL('/login?error=auth_callback_failed', requestUrl.origin)
    );
  }

  // If callback validation fails or no valid parameters were supplied,
  // redirect safely to /login with a sanitized error indicator.
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', requestUrl.origin)
  );
}
