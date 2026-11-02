import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import proxy from '../../src/proxy';
import * as supabaseProxyModule from '../../src/lib/supabase/proxy';

describe('Next.js 16 Routing Proxy & Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

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
    const req = new NextRequest('https://mybusiness.stack37.com/?returnUrl=%2Ftenant%2Facme', {
      headers: { host: 'mybusiness.stack37.com' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://mybusiness.stack37.com/login?returnUrl=%2Ftenant%2Facme');
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

  it('preserves tenant subdomain root routing to /tenant/[tenantSlug] and does not redirect to /login', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/acmecorp');
    expect(res.headers.get('location')).toBeNull();
  });

  it('rewrites tenant subdomain to /tenant/[tenantSlug]', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/dashboard', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/acmecorp/dashboard');
  });

  it('routes shared auth paths (/login, /register, /auth/callback, /auth/confirm, /forgot-password, /reset-password, /verify-email, /select-organization) on mybusiness', async () => {
    const authPaths = ['/login', '/register', '/auth/callback', '/auth/confirm', '/forgot-password', '/reset-password', '/verify-email', '/select-organization'];
    for (const p of authPaths) {
      const req = new NextRequest(`http://mybusiness.localhost:3000${p}`, {
        headers: { host: 'mybusiness.localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-rewrite')).toContain(p);
      expect(res.headers.get('x-middleware-rewrite')).not.toContain('/registration');
    }
  });

  it('routes shared auth paths (/login, /auth/callback) on tenant subdomains', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/login', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/login');
    expect(res.headers.get('x-middleware-rewrite')).not.toContain('/tenant/acmecorp/login');
  });

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
    const req = new NextRequest('http://acmecorp.localhost:3000/tenant/acmecorp', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(404);
  });

  it('routes /registration on mybusiness.localhost without 404 or duplicated path prefix', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/registration', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    const rewriteHeader = res.headers.get('x-middleware-rewrite');
    expect(rewriteHeader).toContain('/registration');
    expect(rewriteHeader).not.toContain('/registration/registration');
  });

  it('routes /registration on tenant subdomains directly without tenant prefix collision', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/registration', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    const rewriteHeader = res.headers.get('x-middleware-rewrite');
    expect(rewriteHeader).toContain('/registration');
    expect(rewriteHeader).not.toContain('/tenant/acmecorp/registration');
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
    const req = new NextRequest('http://mybusiness.localhost:3000/', {
      headers: {
        host: 'mybusiness.localhost:3000',
        'x-tenant-slug': 'attacker-spoofed-slug',
      },
    });

    await proxy(req);
    // Verify client-supplied header was removed from request headers
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

    // 1. Response contains Set-Cookie header for browser
    expect(res.cookies.get('sb-access-token')?.value).toBe('fresh-jwt-token');

    // 2. Downstream request headers have updated cookie header
    expect(req.headers.get('cookie')).toContain('sb-access-token=fresh-jwt-token');

    // 3. Cache-Control protection is applied
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
