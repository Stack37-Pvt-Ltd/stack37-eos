import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  loginAction,
  signupAction,
  forgotPasswordAction,
  resetPasswordAction,
  logoutAction,
} from '../../src/lib/actions/auth';
import { GET as authCallbackGET } from '../../src/app/auth/callback/route';
import { GET as logoutGET, POST as logoutPOST } from '../../src/app/auth/logout/route';
import { createRecoveryToken, RECOVERY_COOKIE_NAME } from '../../src/lib/auth/recovery-token';

// Mock cookies
const mockCookieMap = new Map<string, string>();
const mockCookieStore = {
  get: (name: string) => (mockCookieMap.has(name) ? { name, value: mockCookieMap.get(name)! } : undefined),
  set: (name: string, value: string) => {
    mockCookieMap.set(name, value);
  },
  delete: (name: string) => {
    mockCookieMap.delete(name);
  },
  getAll: () => Array.from(mockCookieMap.entries()).map(([name, value]) => ({ name, value })),
};

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (key: string) => {
      if (key === 'host') return 'mybusiness.localhost:3000';
      if (key === 'x-forwarded-proto') return 'http';
      return null;
    },
  }),
  cookies: vi.fn().mockImplementation(() => Promise.resolve(mockCookieStore)),
}));

// Mock Supabase server client
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('../../src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    },
  }),
}));

describe('Authentication Server Actions & Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieMap.clear();
  });

  describe('loginAction', () => {
    it('returns sanitized error on authentication failure without exposing internal details', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      const result = await loginAction({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address or password.');
    });

    it('returns structured success on valid login credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-uuid-123', email: 'user@example.com' } },
        error: null,
      });

      const result = await loginAction({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-uuid-123');
      expect(result.data?.email).toBe('user@example.com');
    });
  });

  describe('signupAction', () => {
    it('identifies when email confirmation is required (session is null)', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'user-uuid-456', email: 'founder@newbiz.com' },
          session: null,
        },
        error: null,
      });

      const result = await signupAction({
        fullName: 'Business Founder',
        email: 'founder@newbiz.com',
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.emailConfirmationRequired).toBe(true);
      expect(result.data?.userId).toBe('user-uuid-456');
    });

    it('identifies immediate session when email confirmation is not required', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'user-uuid-789', email: 'verified@biz.com' },
          session: { access_token: 'mock-token' },
        },
        error: null,
      });

      const result = await signupAction({
        fullName: 'Verified Founder',
        email: 'verified@biz.com',
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.emailConfirmationRequired).toBe(false);
      expect(result.data?.userId).toBe('user-uuid-789');
    });

    it('prevents account enumeration: returns uniform error message when account already exists', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered', status: 400 },
      });

      const result = await signupAction({
        fullName: 'Existing User',
        email: 'existing@biz.com',
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!',
      });

      expect(result.success).toBe(false);
      // Asserts that the response does NOT state "account already exists"
      expect(result.error).toBe('Registration could not be completed. Please check your details or try signing in.');
    });
  });

  describe('forgotPasswordAction', () => {
    it('returns generic confirmation notice without leaking account existence', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const result = await forgotPasswordAction({ email: 'user@example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('If an account exists with this email address');
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=/reset-password'),
        })
      );
    });
  });

  describe('resetPasswordAction (Authorization Invariant Verification)', () => {
    it('rejects password update if no active user session is present', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Auth session missing' } });

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('session is invalid or has expired');
    });

    it('rejects password update if user has an ordinary authenticated session but lacks recovery authorization', async () => {
      // User is logged in normally
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      // But mockCookieMap has NO recovery cookie

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Password reset requires a verified recovery session');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects password update if cookie contains a plain boolean "true" string instead of a cryptographic token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      // Attacker set document.cookie = "sb-recovery-token=true"
      mockCookieMap.set(RECOVERY_COOKIE_NAME, 'true');

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Password reset requires a verified recovery session');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects password update if recovery token is bound to a different user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-victim-123' } }, error: null });
      // Token generated for attacker user
      const attackerToken = createRecoveryToken('user-attacker-456', 900);
      mockCookieMap.set(RECOVERY_COOKIE_NAME, attackerToken);

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Password reset requires a verified recovery session');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects password update if recovery token signature is tampered', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      const validToken = createRecoveryToken('user-123', 900);
      const [uid, exp] = validToken.split(':');
      mockCookieMap.set(RECOVERY_COOKIE_NAME, `${uid}:${exp}:tampered-hmac-signature`);

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Password reset requires a verified recovery session');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('rejects password update if recovery token has expired', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      // Token expired 60s ago
      const expiredToken = createRecoveryToken('user-123', -60);
      mockCookieMap.set(RECOVERY_COOKIE_NAME, expiredToken);

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Password reset requires a verified recovery session');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('updates password when user possesses verified, user-bound recovery authorization token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      mockUpdateUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });

      // Valid cryptographic token issued for user-123
      const validToken = createRecoveryToken('user-123', 900);
      mockCookieMap.set(RECOVERY_COOKIE_NAME, validToken);

      const result = await resetPasswordAction({
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('Password successfully updated');
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewStrongPassword123!' });

      // Verifies recovery token cookie was consumed and cleared
      expect(mockCookieMap.has(RECOVERY_COOKIE_NAME)).toBe(false);
    });
  });

  describe('logoutAction', () => {
    it('defaults to local logout (current-session only)', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await logoutAction();

      expect(result.success).toBe(true);
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('supports explicit global logout', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await logoutAction({ scope: 'global' });

      expect(result.success).toBe(true);
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    });
  });

  describe('Auth Callback Route Handler (/auth/callback)', () => {
    it('processes PKCE code and redirects to sanitized safe destination', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { user: { id: 'pkce-user-123' }, session: {} },
        error: null,
      });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?code=mock-pkce-code&next=/dashboard'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/dashboard');
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('mock-pkce-code');
      // Regular code exchange does NOT set recovery token
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });

    it('does not grant recovery authorization for ordinary PKCE login callbacks, even if type=recovery is passed in query (forgery defense)', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { user: { id: 'login-user-pkce' }, session: {} },
        error: null,
      });

      // Attacker attempts to forge recovery authorization by passing type=recovery with a login code
      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?code=mock-login-code&type=recovery&next=/reset-password'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/reset-password');
      // Invariant: PKCE code exchange never issues recovery authorization
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });

    it('sets cryptographic sb-recovery-token cookie when processing genuine verified recovery flow via verifyOtp', async () => {
      mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'recovery-user-999' } }, error: null });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?token_hash=mock-hash&type=recovery&next=/reset-password'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/reset-password');
      // Verify user-bound recovery authorization cookie was set on redirect response
      const token = res.cookies.get(RECOVERY_COOKIE_NAME)?.value;
      expect(token).toBeDefined();
      expect(token).toContain('recovery-user-999:');
    });

    it('does not set recovery cookie for non-recovery verification (signup with type=email or type=signup)', async () => {
      mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'signup-user-123' } }, error: null });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?token_hash=mock-hash&type=email&next=/select-organization'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/select-organization');
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });

    it('rejects unapproved callback hosts with 400 Bad Request', async () => {
      const req = new NextRequest(
        'http://attacker.com/auth/callback?token_hash=mock-hash&type=email',
        { headers: { host: 'attacker.com' } }
      );
      const res = await authCallbackGET(req);
      expect(res.status).toBe(400);
    });

    it('neutralizes malicious external redirect targets', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { user: { id: 'pkce-user-123' }, session: {} },
        error: null,
      });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?code=mock-pkce-code&next=https://attacker.com'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      // Malicious URL was neutralized and fell back to default /select-organization
      expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/select-organization');
    });

    it('redirects to /login with error indicator when PKCE code exchange fails (expired or invalid code)', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'Invalid or expired code' } });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?code=invalid-code'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://mybusiness.localhost:3000/login?error=auth_callback_failed'
      );
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });

    it('redirects to /login with error indicator when verifyOtp fails (invalid or expired recovery link)', async () => {
      mockVerifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });

      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?token_hash=invalid-hash&type=recovery'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://mybusiness.localhost:3000/login?error=auth_callback_failed'
      );
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });

    it('redirects to /login when unverified query parameters are passed without token_hash or code (callback forgery defense)', async () => {
      const req = new NextRequest(
        'http://mybusiness.localhost:3000/auth/callback?type=recovery&next=/reset-password'
      );
      const res = await authCallbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://mybusiness.localhost:3000/login?error=auth_callback_failed'
      );
      expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
    });
  });

  describe('Logout Route Handler (/auth/logout) Cross-Origin Defense', () => {
    it('rejects GET requests with 405 Method Not Allowed (CSRF prevention)', async () => {
      const res = await logoutGET();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
    });

    it('rejects cross-origin POST requests with 403 Forbidden', async () => {
      const req = new NextRequest('http://mybusiness.localhost:3000/auth/logout', {
        method: 'POST',
        headers: {
          host: 'mybusiness.localhost:3000',
          origin: 'http://malicious-site.com',
        },
      });
      const res = await logoutPOST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Forbidden: Cross-origin logout request rejected.');
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('accepts same-origin POST requests and executes local logout', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const req = new NextRequest('http://mybusiness.localhost:3000/auth/logout', {
        method: 'POST',
        headers: {
          host: 'mybusiness.localhost:3000',
          origin: 'http://mybusiness.localhost:3000',
        },
      });
      const res = await logoutPOST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.scope).toBe('local');
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('accepts same-origin POST requests with global logout scope', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const req = new NextRequest('http://mybusiness.localhost:3000/auth/logout', {
        method: 'POST',
        headers: {
          host: 'mybusiness.localhost:3000',
          origin: 'http://mybusiness.localhost:3000',
        },
        body: JSON.stringify({ scope: 'global' }),
      });
      const res = await logoutPOST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.scope).toBe('global');
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    });
  });
});
