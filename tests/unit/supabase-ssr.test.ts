import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('Supabase SSR Client Infrastructure', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xbiadendaxhoyrcvaybf.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
  });

  it('createClient (browser) initializes successfully with expected config', async () => {
    const { createClient } = await import('../../src/lib/supabase/client');
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('createClient (browser) throws descriptive error if environment variables are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { createClient } = await import('../../src/lib/supabase/client');
    expect(() => createClient()).toThrow(/Missing Supabase configuration/);
  });

  it('createClient (server) uses Next.js 16 async cookies', async () => {
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: 'test', value: '123' }]),
      set: vi.fn(),
    };

    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue(mockCookieStore),
    }));

    const { createClient } = await import('../../src/lib/supabase/server');
    const client = await createClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();

    vi.doUnmock('next/headers');
  });

  it('updateSession handles unauthenticated requests cleanly and returns user: null', async () => {
    const { updateSession } = await import('../../src/lib/supabase/proxy');
    const req = new NextRequest('http://mybusiness.localhost:3000/');
    const result = await updateSession(req);

    expect(result).toBeDefined();
    expect(result.user).toBeNull();
    expect(result.hasCookiesSet).toBe(false);
    expect(result.supabaseResponse).toBeDefined();
  });
});
