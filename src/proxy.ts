import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'auth',
  'mybusiness',
]);

export default async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Get host safely
  let host = request.headers.get('host') || '';
  
  // Clean port for local testing
  host = host.split(':')[0];

  // In production, enforce domain logic. For local, handle localhost
  const isLocalhost = host.endsWith('localhost');
  const baseDomain = isLocalhost ? 'localhost' : 'stack37.com';

  // Subdomain parsing
  let subdomain = '';
  if (host.endsWith(`.${baseDomain}`)) {
    subdomain = host.replace(`.${baseDomain}`, '');
  }

  // Next.js internal paths should pass through unaltered
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 1. Prevent direct access to internal tenant routes
  if (url.pathname.startsWith('/tenant')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 2. Reserved subdomains (other than mybusiness) -> block or handle
  if (RESERVED_SUBDOMAINS.has(subdomain) && subdomain !== 'mybusiness') {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 3. Security: Sanitize client-supplied tenant headers
  // Client-supplied tenant identity headers are never authoritative.
  request.headers.delete('x-tenant-slug');

  // 4. Default / no subdomain -> return 404 for this app
  const isValidSubdomain =
    subdomain && subdomain !== baseDomain && !RESERVED_SUBDOMAINS.has(subdomain) ||
    subdomain === 'mybusiness';

  if (!isValidSubdomain) {
    return new NextResponse('Not Found (STACK37 EOS requires a valid subdomain)', { status: 404 });
  }

  // 5. Determine target path (Shared auth routes vs subdomain rewrites)
  const SHARED_AUTH_PREFIXES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/select-organization',
    '/registration',
    '/auth',
  ];

  const isSharedAuthRoute = SHARED_AUTH_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );

  let targetUrl: URL;
  if (isSharedAuthRoute) {
    // Shared authentication routes map directly to top-level handlers
    targetUrl = url;
  } else if (subdomain === 'mybusiness') {
    // mybusiness subdomain root -> registration route
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/registration';
    } else if (!url.pathname.startsWith('/registration')) {
      url.pathname = `/registration${url.pathname}`;
    }
    targetUrl = url;
  } else {
    // Tenant subdomain -> tenant route
    url.pathname = `/tenant/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    targetUrl = url;
  }

  // 6. Synchronize Supabase session and refresh tokens
  const { supabaseResponse, user, hasCookiesSet } = await updateSession(request);

  // Synchronize request.headers 'cookie' so downstream Server Components see refreshed tokens
  if (hasCookiesSet) {
    request.headers.set('cookie', request.cookies.toString());
  }

  // 7. Rewrite to target URL preserving updated request headers
  const rewrittenResponse = NextResponse.rewrite(targetUrl, {
    request: {
      headers: request.headers,
    },
  });

  // Copy any Set-Cookie headers from supabaseResponse to the rewritten response (for the browser)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    rewrittenResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  // 8. Prevent public caching of authenticated responses or responses containing session Set-Cookie headers
  if (user !== null || hasCookiesSet) {
    rewrittenResponse.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, max-age=0, must-revalidate'
    );
  }

  return rewrittenResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
