import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from '../../src/proxy';

describe('Next.js 16 Routing Proxy & Security Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
