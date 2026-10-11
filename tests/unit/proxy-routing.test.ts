import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import proxy from '../../src/proxy';
import * as supabaseProxyModule from '../../src/lib/supabase/proxy';

describe('Next.js 16 Routing Proxy & Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('rewrites mybusiness subdomain to /registration', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/', {
      headers: { host: 'mybusiness.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    // In Next.js rewrite responses, x-middleware-rewrite header indicates internal rewrite destination
    expect(res.headers.get('x-middleware-rewrite')).toContain('/registration');
  });

  it('rewrites tenant subdomain to /tenant/[tenantSlug]', async () => {
    const req = new NextRequest('http://acmecorp.localhost:3000/dashboard', {
      headers: { host: 'acmecorp.localhost:3000' },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/tenant/acmecorp/dashboard');
  });

  it('routes shared auth paths (/login, /register, /auth/callback, /forgot-password, /reset-password, /verify-email, /select-organization) on mybusiness', async () => {
    const authPaths = ['/login', '/register', '/auth/callback', '/forgot-password', '/reset-password', '/verify-email', '/select-organization'];
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

  it('blocks direct access to internal /registration routes with 404', async () => {
    const req = new NextRequest('http://mybusiness.localhost:3000/registration', {
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
