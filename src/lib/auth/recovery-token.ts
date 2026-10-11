import crypto from 'crypto';

export const RECOVERY_COOKIE_NAME = 'sb-recovery-token';

/**
 * Resolves the dedicated server-only secret for signing password recovery application state.
 * 
 * Security Invariants:
 * 1. NEVER use SUPABASE_SERVICE_ROLE_KEY for general application token signing.
 *    The service role key is a superuser database credential that bypasses RLS,
 *    not an application HMAC secret.
 * 2. Uses EOS_RECOVERY_SECRET or AUTH_SECRET, falling back to a dedicated fallback in non-production.
 */
function getRecoverySecret(): string {
  const secret = process.env.EOS_RECOVERY_SECRET || process.env.AUTH_SECRET;
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error(
        'EOS_RECOVERY_SECRET must be at least 32 characters long for cryptographic security.'
      );
    }
    return secret;
  }

  // Fail securely in production: never allow fallback secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing EOS_RECOVERY_SECRET in production. A dedicated server-only secret of at least 32 characters is required.'
    );
  }

  return 'stack37-eos-dedicated-recovery-token-signing-secret';
}

/**
 * Generates a tamper-resistant, time-limited cryptographic token
 * proving that an authorized password recovery event was verified by Supabase Auth
 * for a specific user ID.
 * 
 * Token format: `${userId}:${exp}:${hmac}`
 * 
 * Invariants:
 * - Tamper-resistant: HMAC-SHA256 signature using dedicated server secret.
 * - Time-limited: Expires after expiresInSeconds (default 15 minutes / 900s).
 * - User-bound: Strictly associated with target user ID.
 */
export function createRecoveryToken(userId: string, expiresInSeconds = 900): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required to generate recovery token');
  }

  const secret = getRecoverySecret();
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${userId}:${exp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `${payload}:${hmac}`;
}

/**
 * Validates a recovery token against the currently authenticated user ID.
 * Rejects plain boolean cookies, missing tokens, mismatched users, expired timestamps, and tampered signatures.
 */
export function verifyRecoveryToken(
  token: string | null | undefined,
  expectedUserId: string
): boolean {
  if (!token || typeof token !== 'string' || !expectedUserId) {
    return false;
  }

  const parts = token.split(':');
  if (parts.length !== 3) {
    return false; // Rejects plain boolean strings like 'true'
  }

  const [userId, expStr, hmac] = parts;
  if (userId !== expectedUserId) {
    return false; // Token bound to a different user
  }

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false; // Expired
  }

  const secret = getRecoverySecret();
  const payload = `${userId}:${expStr}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
  } catch {
    return false;
  }
}
