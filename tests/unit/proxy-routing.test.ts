import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import proxy from '../../src/proxy';
import * as supabaseProxyModule from '../../src/lib/supabase/proxy';

describe('Next.js 16 Routing Proxy & Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Central Portal Root Redirection
  // =========================================================================
  it('redirects central mybusiness portal root (mybusiness.localhost:3000/) to /login', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/login');
  });

  it('redirects central mybusiness portal root in production (mybusiness.stack37.com/) to /login', async () => {
    const req = new NextRequest('https://mybusiness.stack37.com/', {
      headers: { host: 'mybusiness.stack37.com' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://mybusiness.stack37.com/login');
  });

  it('preserves query parameters when redirecting central mybusiness portal root to /login', async () => {
    const req = new NextRequest('https://mybusiness.stack37.com/?next=%2Fw%2Ftest', {
      headers: { host: 'mybusiness.stack37.com' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://mybusiness.stack37.com/login?next=%2Fw%2Ftest');
  });

  it('preserves Set-Cookie and applies private Cache-Control when session refreshes during root redirect', async () => {
    const mockSupabaseResponse = NextResponse.next();
    mockSupabaseResponse.cookies.set('sb-access-token', 'fresh-portal-jwt', {
      path: '/',
      sameSite: 'lax',
      secure: false,
    });

    vi.spyOn(supabaseProxyModule, 'updateSession').mockImplementation(async (r) => {
      r.cookies.set('sb-access-token', 'fresh-portal-jwt');
      return {
        supabaseResponse: mockSupabaseResponse,
        user: { id: 'portal-user-id' } as unknown as import('@supabase/supabase-js').User,
        hasCookiesSet: true,
      };
    });

    const req = new NextRequest('http://mybusiness.localhost:3000/', {
      headers: { host: 'mybusiness.localhost:3000' },
    });

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/login');
    expect(res.cookies.get('sb-access-token')?.value).toBe('fresh-portal-jwt');
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache, no-store, max-age=0, must-revalidate');
  });

  // =========================================================================
  // 2. Collision-Safe Workspace Routing (/w/:tenantSlug/...)
  // =========================================================================
  it('redirects /w and /w/ on mybusiness to /select-organization', async () => {
    for (const p of ['/w', '/w/']) {
      const req = new NextRequest(`http://mybusiness.localhost:3000${p}`, {
        headers: { host: 'mybusiness.localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/select-organization');
    }
  });

  it('rewrites /w/:tenantSlug to /tenant/:tenantSlug and sets x-pathname and x-tenant-slug headers', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/w/test', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/test');
    expect(req.headers.get('x-pathname')).toBe('/w/test');
    expect(req.headers.get('x-tenant-slug')).toBe('test');
  });

  it('rewrites /w/:tenantSlug/settings to /tenant/:tenantSlug/settings and sets x-pathname header', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/w/test/settings', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/test/settings');
    expect(req.headers.get('x-pathname')).toBe('/w/test/settings');
    expect(req.headers.get('x-tenant-slug')).toBe('test');
  });

  it('normalizes trailing slash on /w/:tenantSlug/ to /tenant/:tenantSlug', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/w/test/', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/test');
  });

  it('normalizes uppercase or mixed-case slug /w/TestOrg to /w/testorg with 308 redirect', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/w/TestOrg/settings', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/w/testorg/settings');
  });

  it('blocks invalid tenant slugs under /w/ with 404', async () => {
    const invalidSlugs = ['ab', '-leading-hyphen', 'trailing-hyphen-', 'double--hyphen', 'special$char', 'a'.repeat(64)];
    for (const slug of invalidSlugs) {
      const req = new NextRequest(`http://mybusiness.localhost:3000/w/${slug}`, {
        headers: { host: 'mybusiness.localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(404);
    }
  });

  it('blocks reserved slugs under /w/ with 404 (e.g. /w/admin, /w/billing)', async () => {
    const reservedSlugs = ['admin', 'api', 'app', 'auth', 'billing', 'support', 'www', 'mybusiness', 'portal', 'status'];
    for (const slug of reservedSlugs) {
      const req = new NextRequest(`http://mybusiness.localhost:3000/w/${slug}`, {
        headers: { host: 'mybusiness.localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(404);
    }
  });

  // =========================================================================
  // 3. Shared Auth Routes on Canonical Portal
  // =========================================================================
  it('routes shared auth paths (/login, /register, /auth/callback, /auth/confirm, /forgot-password, /reset-password, /verify-email, /select-organization, /registration) on mybusiness', async () => {
    const authPaths = [
      '/login',
      '/register',
      '/auth/callback',
      '/auth/confirm',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/select-organization',
      '/registration',
    ];
    for (const p of authPaths) {
      const req = new NextRequest(`http://mybusiness.localhost:3000${p}`, {
        headers: { host: 'mybusiness.localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-rewrite')).toContain(p);
      expect(res.headers.get('x-middleware-rewrite')).not.toContain('/tenant/');
    }
  });

  // =========================================================================
  // 4. Legacy Subdomain Forwarding & Token Protection
  // =========================================================================
  it('redirects legacy tenant subdomain root (acmecorp.localhost:3000/) to /w/acmecorp on mybusiness', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/w/acmecorp');
  });

  it('redirects legacy tenant subdomain deep link (acmecorp.localhost:3000/dashboard) to /w/acmecorp/dashboard on mybusiness', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/dashboard', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/w/acmecorp/dashboard');
  });

  it('redirects legacy tenant subdomain in production (test.stack37.com/settings) to https://mybusiness.stack37.com/w/test/settings', async () => {
    const req = new NextRequest('https://test.stack37.com/settings', {
      headers: { host: 'test.stack37.com' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://mybusiness.stack37.com/w/test/settings');
  });

  it('neutralizes auth callback endpoints on legacy subdomain with 307 redirect without forwarding code or tokens', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/auth/callback?code=sensitive-pkce-code&state=xyz', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toBe('http://mybusiness.localhost:3000/login?error=auth_callback_host_mismatch');
    expect(location).not.toContain('sensitive-pkce-code');
    expect(location).not.toContain('xyz');
  });

  it('redirects legacy subdomain /login to central /login?next=/w/:subdomain', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/login', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/login?next=/w/acmecorp');
  });

  it('redirects shared auth paths (/registration) on legacy tenant subdomain to canonical portal domain', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/registration', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/registration');
  });

  it('strips sensitive tokens (code, token_hash, access_token) from query parameters when redirecting legacy subdomain', async () => {
    const req = new NextRequest(
      'http://acmecorp.localhost:3000/settings?tab=general&code=leak-me&token_hash=hash-leak&access_token=jwt-leak',
      {
        headers: { host: 'acmecorp.localhost:3000' },
      }
    );
    const res = await proxy(req);

    expect(res.status).toBe(308);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/w/acmecorp/settings?tab=general');
    expect(location).not.toContain('leak-me');
    expect(location).not.toContain('hash-leak');
    expect(location).not.toContain('jwt-leak');
  });

  it('preserves safe query parameters (tab=general) when redirecting legacy subdomain', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/settings?tab=security&mode=compact', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/w/acmecorp/settings?tab=security&mode=compact');
  });

  // =========================================================================
  // 5. Security & Boundary Protections
  // =========================================================================
  it('blocks reserved subdomains (admin, www, api, app, auth) with 404', async () => {
    const reserved = ['admin', 'www', 'api', 'app', 'auth'];
    for (const sub of reserved) {
      const req = new NextRequest(`http://${sub}.localhost:3000/`, {
        headers: { host: `${sub}.localhost:3000` },
      });
      const res = await proxy(req);
      expect(res.status).toBe(404);
    }
  });

  it('blocks direct access to internal /tenant routes with 404', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/tenant/acmecorp', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(404);
  });

  it('blocks root host without subdomain with 404', async () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: { host: 'localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(404);
  });

  it('passes Next.js internal static assets through without rewriting', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/_next/static/test.js', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('sanitizes client-supplied x-tenant-slug header to prevent spoofing', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/login', {
      headers: {
        host: 'mybusiness.localhost:3000',
        'x-tenant-slug': 'attacker-spoofed-slug',
      },
    });

    await proxy(req);
    expect(req.headers.get('x-tenant-slug')).toBeNull();
  });

  it('preserves Set-Cookie on response and forwards refreshed cookies to downstream request', async () => {
    const mockSupabaseResponse = NextResponse.next();
    mockSupabaseResponse.cookies.set('sb-access-token', 'fresh-jwt-token', {
      path: '/',
      sameSite: 'lax',
      secure: false,
    });

    vi.spyOn(supabaseProxyModule, 'updateSession').mockImplementation(async (r) => {
      r.cookies.set('sb-access-token', 'fresh-jwt-token');
      return {
        supabaseResponse: mockSupabaseResponse,
        user: { id: 'test-user-id' } as unknown as import('@supabase/supabase-js').User,
        hasCookiesSet: true,
      };
    });

    const req = new NextRequest('http://mybusiness.localhost:3000/login', {
      headers: { host: 'mybusiness.localhost:3000' },
    });

    const res = await proxy(req);

    expect(res.cookies.get('sb-access-token')?.value).toBe('fresh-jwt-token');
    expect(req.headers.get('cookie')).toContain('sb-access-token=fresh-jwt-token');
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache, no-store, max-age=0, must-revalidate');
  });

  it('does not set private Cache-Control header when unauthenticated with no cookie modifications', async () => {
    const mockSupabaseResponse = NextResponse.next();
    vi.spyOn(supabaseProxyModule, 'updateSession').mockResolvedValue({
      supabaseResponse: mockSupabaseResponse,
      user: null,
      hasCookiesSet: false,
    });

    const req = new NextRequest('http://mybusiness.localhost:3000/', {
      headers: { host: 'mybusiness.localhost:3000' },
    });

    const res = await proxy(req);
    expect(res.headers.get('Cache-Control')).toBeNull();
  });
});
