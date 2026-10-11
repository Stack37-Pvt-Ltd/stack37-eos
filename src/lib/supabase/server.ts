import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Adheres to Next.js 16 asynchronous cookie access conventions (await cookies()).
 * 
 * Cookie Policy:
 * Host-only cookie scope is strictly enforced (domain is left undefined).
 * Cookies are scoped strictly to the current host (e.g. mybusiness.stack37.com or tenant.stack37.com),
 * ensuring the corporate stack37.com marketing website receives zero auth cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined.'
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              // Enforce host-only cookie scope: do not allow wildcard domain
              domain: undefined,
              secure: process.env.NODE_ENV === 'production',
            })
          );
        } catch {
          // In Next.js Server Components, mutating cookies is disallowed and will throw.
          // This is expected and safe when proxy/middleware handles session refresh.
        }
      },
    },
  });
}
