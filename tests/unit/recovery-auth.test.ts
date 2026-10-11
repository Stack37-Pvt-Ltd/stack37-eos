import { describe, it, expect } from 'vitest';
import { createRecoveryToken, verifyRecoveryToken, RECOVERY_COOKIE_NAME } from '../../src/lib/auth/recovery-token';

describe('Cryptographic Password Recovery Token System', () => {
  it('defines the correct host-only recovery cookie name', () => {
    expect(RECOVERY_COOKIE_NAME).toBe('sb-recovery-token');
  });

  it('generates a valid, verifiable recovery token bound to a specific user', () => {
    const userId = 'user-uuid-1234';
    const token = createRecoveryToken(userId, 900);

    expect(typeof token).toBe('string');
    expect(token.split(':')).toHaveLength(3);

    const isValid = verifyRecoveryToken(token, userId);
    expect(isValid).toBe(true);
  });

  it('rejects plain boolean cookies or string values like "true"', () => {
    expect(verifyRecoveryToken('true', 'user-uuid-1234')).toBe(false);
    expect(verifyRecoveryToken('false', 'user-uuid-1234')).toBe(false);
    expect(verifyRecoveryToken('', 'user-uuid-1234')).toBe(false);
    expect(verifyRecoveryToken(null, 'user-uuid-1234')).toBe(false);
    expect(verifyRecoveryToken(undefined, 'user-uuid-1234')).toBe(false);
  });

  it('rejects tokens used by a different user than the bound target', () => {
    const userA = 'user-uuid-aaaa';
    const userB = 'user-uuid-bbbb';
    const tokenA = createRecoveryToken(userA, 900);

    // Attempting to use User A's token for User B
    const isValid = verifyRecoveryToken(tokenA, userB);
    expect(isValid).toBe(false);
  });

  it('rejects tampered tokens where payload or signature is modified', () => {
    const userId = 'user-uuid-1234';
    const token = createRecoveryToken(userId, 900);
    const [uid, exp, hmac] = token.split(':');

    // Tamper with user ID
    const tamperedUser = `different-user:${exp}:${hmac}`;
    expect(verifyRecoveryToken(tamperedUser, 'different-user')).toBe(false);

    // Tamper with expiry
    const tamperedExp = `${uid}:${parseInt(exp, 10) + 1000}:${hmac}`;
    expect(verifyRecoveryToken(tamperedExp, userId)).toBe(false);

    // Tamper with HMAC signature
    const tamperedHmac = `${uid}:${exp}:0000000000000000000000000000000000000000000000000000000000000000`;
    expect(verifyRecoveryToken(tamperedHmac, userId)).toBe(false);
  });

  it('rejects expired recovery tokens', () => {
    const userId = 'user-uuid-1234';
    // Expired 10 seconds ago
    const expiredToken = createRecoveryToken(userId, -10);

    const isValid = verifyRecoveryToken(expiredToken, userId);
    expect(isValid).toBe(false);
  });

  it('uses a dedicated server-only secret and functions independently of SUPABASE_SERVICE_ROLE_KEY', () => {
    const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalRecoverySecret = process.env.EOS_RECOVERY_SECRET;

    try {
      // Unset service role key completely
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.EOS_RECOVERY_SECRET = 'custom-dedicated-recovery-secret-123';

      const userId = 'user-uuid-isolated';
      const token = createRecoveryToken(userId, 900);
      expect(verifyRecoveryToken(token, userId)).toBe(true);

      // Mutate recovery secret: verification must fail (proving dependency on dedicated secret, not service role key)
      process.env.EOS_RECOVERY_SECRET = 'different-signing-secret-456';
      expect(verifyRecoveryToken(token, userId)).toBe(false);
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
      if (originalRecoverySecret !== undefined) {
        process.env.EOS_RECOVERY_SECRET = originalRecoverySecret;
      } else {
        delete process.env.EOS_RECOVERY_SECRET;
      }
    }
  });

  it('fails securely in production when EOS_RECOVERY_SECRET is missing or insufficiently strong (<32 chars)', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRecoverySecret = process.env.EOS_RECOVERY_SECRET;
    const originalAuthSecret = process.env.AUTH_SECRET;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.EOS_RECOVERY_SECRET;
      delete process.env.AUTH_SECRET;

      // 1. Missing secret in production must throw
      expect(() => createRecoveryToken('user-123', 900)).toThrow(/Missing EOS_RECOVERY_SECRET in production/);

      // 2. Weak secret (<32 chars) in production must throw
      process.env.EOS_RECOVERY_SECRET = 'short-secret';
      expect(() => createRecoveryToken('user-123', 900)).toThrow(/at least 32 characters long/);

      // 3. Strong secret (>=32 chars) in production must succeed
      process.env.EOS_RECOVERY_SECRET = 'this-is-a-very-strong-production-recovery-secret-32ch';
      const token = createRecoveryToken('user-123', 900);
      expect(verifyRecoveryToken(token, 'user-123')).toBe(true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      if (originalRecoverySecret !== undefined) {
        process.env.EOS_RECOVERY_SECRET = originalRecoverySecret;
      } else {
        delete process.env.EOS_RECOVERY_SECRET;
      }
      if (originalAuthSecret !== undefined) {
        process.env.AUTH_SECRET = originalAuthSecret;
      } else {
        delete process.env.AUTH_SECRET;
      }
    }
  });
});
