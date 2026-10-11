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
});
