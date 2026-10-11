import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

export interface SessionRefreshResult {
  supabaseResponse: NextResponse;
  user: User | null;
  hasCookiesSet: boolean;
}

/**
 * Refreshes the Supabase Auth session in Next.js Proxy/Middleware,
 * synchronizing cookies between the incoming request and outgoing response.
 * 
 * Security Controls:
 * 1. Enforces host-only cookie scope (domain is undefined).
 * 2. Uses supabase.auth.getUser() to cryptographically verify the JWT against
 *    Supabase Auth servers, rejecting unverified local getSession() claims.
 * 3. Tracks whether new cookies were set during the token refresh cycle.
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionRefreshResult> {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      supabaseResponse,
      user: null,
      hasCookiesSet: false,
    };
  }

  let hasCookiesSet = false;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      domain: undefined, // Enforce host-only
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        hasCookiesSet = true;
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            domain: undefined, // Enforce host-only
            secure: process.env.NODE_ENV === 'production',
          })
        );
      },
    },
  });

  // IMPORTANT: Never trust getSession() for server-side verification.
  // getUser() sends a request to Supabase Auth to cryptographically validate the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabaseResponse,
    user,
    hasCookiesSet,
  };
}
