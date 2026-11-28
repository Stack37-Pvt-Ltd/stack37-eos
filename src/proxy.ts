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

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'support',
  'www',
  'mybusiness',
  'portal',
  'status',
  'mail',
  'staging',
  'dev',
  'w',
  'workspace',
  'settings',
  'tenant',
  'dashboard',
]);

const SLUG_REGEX = /^[a-z0-9](-?[a-z0-9]){1,61}[a-z0-9]$/;

const SHARED_AUTH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/select-organization',
  '/registration',
  '/auth',
  '/invite/accept',
];

const SENSITIVE_QUERY_PARAMS = new Set([
  'code',
  'token_hash',
  'token',
  'access_token',
  'refresh_token',
  'sb-recovery-token',
]);

export default async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Get host safely and clean port for local testing
  const host = request.headers.get('host') || '';
  const [hostname, port] = host.split(':');
  const deploymentHost = process.env.VERCEL_URL?.trim().toLowerCase();
  const isVercelHost = hostname.endsWith('.vercel.app');
  const isExactVercelPreview =
    isVercelHost ||
    (process.env.VERCEL_ENV === 'preview' &&
      Boolean(deploymentHost) &&
      host.toLowerCase() === deploymentHost);

  // In production, enforce domain logic. For local, handle localhost
  const isLocalhost = hostname.endsWith('localhost') || hostname === 'localhost';
  const baseDomain = isLocalhost ? 'localhost' : 'stack37.com';

  // Subdomain parsing
  let subdomain = '';
  if (isExactVercelPreview) {
    // Treat any Vercel Preview hostname as the portal host.
    subdomain = 'mybusiness';
  } else if (hostname.endsWith(`.${baseDomain}`)) {
    subdomain = hostname.replace(`.${baseDomain}`, '');
  }

  // 1. Next.js internal paths and static assets pass through unaltered
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Prevent direct access to internal tenant routes
  if (url.pathname.startsWith('/tenant')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 3. Reserved subdomains (other than mybusiness) -> block with 404
  if (RESERVED_SUBDOMAINS.has(subdomain) && subdomain !== 'mybusiness') {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 4. Security: Sanitize client-supplied tenant headers
  // Client-supplied tenant identity headers are never authoritative.
  request.headers.delete('x-tenant-slug');

  // 5. Default / no subdomain -> return 404 for this app
  const isValidSubdomain =
    isExactVercelPreview ||
    (subdomain && subdomain !== baseDomain && !RESERVED_SUBDOMAINS.has(subdomain)) ||
    subdomain === 'mybusiness';

  if (!isValidSubdomain) {
    return new NextResponse('Not Found (STACK37 EOS requires a valid subdomain)', { status: 404 });
  }

  const portSuffix = port ? `:${port}` : '';
  const canonicalPortalOrigin = isExactVercelPreview
    ? `https://${host}`
    : isLocalhost
      ? `http://mybusiness.localhost${portSuffix}`
      : 'https://mybusiness.stack37.com';

  // 6. Handle legacy tenant subdomains (*.stack37.com or *.localhost:3000)
  if (subdomain !== 'mybusiness') {
    // 6a. Auth callback/confirm endpoints: redirect to portal login with error, NEVER echoing credentials
    if (url.pathname.startsWith('/auth')) {
      const redirectUrl = new URL('/login?error=auth_callback_host_mismatch', canonicalPortalOrigin);
      return NextResponse.redirect(redirectUrl, 307);
    }

    // 6b. Direct login requests on legacy subdomain: redirect to central login with safe return path
    if (url.pathname === '/login') {
      const redirectUrl = new URL(`/login?next=/w/${subdomain}`, canonicalPortalOrigin);
      return NextResponse.redirect(redirectUrl, 308);
    }

    // 6c. Shared auth/system routes on legacy subdomain: redirect to canonical portal route
    const isSharedAuthRoute = SHARED_AUTH_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
    if (isSharedAuthRoute) {
      const redirectUrl = new URL(url.pathname, canonicalPortalOrigin);
      return NextResponse.redirect(redirectUrl, 308);
    }

    // 6d. Navigational workspace paths: 308 redirect to /w/:subdomain/* with sensitive tokens stripped
    const targetPath = `/w/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    const redirectUrl = new URL(targetPath, canonicalPortalOrigin);

    url.searchParams.forEach((val, key) => {
      if (!SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        redirectUrl.searchParams.set(key, val);
      }
    });

    return NextResponse.redirect(redirectUrl, 308);
  }

  // 7. Route requests on the canonical portal domain (mybusiness.stack37.com)
  const isSharedAuthRoute = SHARED_AUTH_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );

  let targetUrl: URL;

  if (isSharedAuthRoute) {
    // Shared authentication routes map directly to top-level handlers
    targetUrl = url;
  } else if (url.pathname === '/' || url.pathname === '') {
    // Central portal root -> redirect to /login (307)
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const { supabaseResponse, user, hasCookiesSet } = await updateSession(request);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    if (user !== null || hasCookiesSet) {
      redirectResponse.headers.set(
        'Cache-Control',
        'private, no-cache, no-store, max-age=0, must-revalidate'
      );
    }
    return redirectResponse;
  } else if (url.pathname === '/w' || url.pathname === '/w/') {
    // Workspace prefix without slug -> redirect to organization directory
    const redirectUrl = new URL('/select-organization', canonicalPortalOrigin);
    return NextResponse.redirect(redirectUrl, 307);
  } else if (url.pathname.startsWith('/w/')) {
    // Workspace path under /w/:tenantSlug/*
    const match = url.pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
    if (!match) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const rawSlug = match[1];
    const rawSubpath = match[2] || '';

    // Case normalization: canonical lowercase redirect
    if (rawSlug !== rawSlug.toLowerCase()) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/w/${rawSlug.toLowerCase()}${rawSubpath}`;
      return NextResponse.redirect(redirectUrl, 308);
    }

    const tenantSlug = rawSlug.toLowerCase();

    // Validate tenant slug format and reserved names
    if (!SLUG_REGEX.test(tenantSlug) || RESERVED_SLUGS.has(tenantSlug)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Forward original public path and authoritative tenant identity to Server Components
    request.headers.set('x-pathname', url.pathname);
    request.headers.set('x-tenant-slug', tenantSlug);

    // Internal rewrite: /w/:tenantSlug/* -> /tenant/:tenantSlug/*
    const subpath = rawSubpath === '/' ? '' : rawSubpath;
    url.pathname = `/tenant/${tenantSlug}${subpath}`;
    targetUrl = url;
  } else {
    // Unmatched top-level path on portal host -> pass to App Router (fails closed with 404)
    targetUrl = url;
  }

  // 8. Synchronize Supabase session and refresh tokens
  const { supabaseResponse, user, hasCookiesSet } = await updateSession(request);

  // Synchronize request.headers 'cookie' so downstream Server Components see refreshed tokens
  if (hasCookiesSet) {
    request.headers.set('cookie', request.cookies.toString());
  }

  // 9. Rewrite to target URL preserving updated request headers
  const rewrittenResponse = NextResponse.rewrite(targetUrl, {
    request: {
      headers: request.headers,
    },
  });

  // Copy any Set-Cookie headers from supabaseResponse to the rewritten response (for the browser)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    rewrittenResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  // 10. Prevent public caching of authenticated responses or responses containing session Set-Cookie headers
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
