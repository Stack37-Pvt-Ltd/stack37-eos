import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'auth',
  'mybusiness',
]);

export default function proxy(request: NextRequest) {
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

  // 1. Prevent direct access to internal tenant/registration routes
  if (url.pathname.startsWith('/tenant') || url.pathname.startsWith('/registration')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 2. mybusiness subdomain -> registration route
  if (subdomain === 'mybusiness') {
    url.pathname = `/registration${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 3. Reserved subdomains (other than mybusiness) -> block or handle
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 4. Tenant subdomain -> tenant route
  if (subdomain && subdomain !== baseDomain) {
    url.pathname = `/tenant/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 5. Default / no subdomain -> return 404 for this app
  return new NextResponse('Not Found (STACK37 EOS requires a valid subdomain)', { status: 404 });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
