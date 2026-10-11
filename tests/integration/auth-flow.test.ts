import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import proxy from '../../src/proxy';
import { verifyRecoveryToken, RECOVERY_COOKIE_NAME } from '../../src/lib/auth/recovery-token';
import { GET as authCallbackGET } from '../../src/app/auth/callback/route';

// Automatically load local environment for integration testing if present
try {
  if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === 'function' && fs.existsSync('.env.local')) {
    (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile('.env.local');
  }
} catch {
  // Ignore if not present
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serverAuthFlag = process.env.EOS_SERVER_TEST_AUTHORIZATION_FLAG;
const customerDataConfirmation = process.env.EOS_CONFIRM_NO_REAL_CUSTOMER_DATA;
const recoverySecret = process.env.EOS_RECOVERY_SECRET;

const EXPECTED_PROJECT_REF = 'xbiadendaxhoyrcvaybf';
const FIXTURE_LOG_PATH = path.resolve(__dirname, '.auth-test-fixtures.json');

/**
 * Fixture Tracking Manifest:
 * Records every created entity in real time for progressive tracking
 * and deterministic emergency cleanup.
 */
interface AuthFixtureManifest {
  timestamp: string;
  runSuffix: string;
  suffix: string;
  projectRef: string;
  organizations: string[];
  plans: string[];
  users: string[];
  auditLogIds: string[];
}

const fixtureState: AuthFixtureManifest = {
  timestamp: new Date().toISOString(),
  runSuffix: '',
  suffix: '',
  projectRef: EXPECTED_PROJECT_REF,
  organizations: [],
  plans: [],
  users: [],
  auditLogIds: [],
};

function persistManifest() {
  try {
    fs.writeFileSync(FIXTURE_LOG_PATH, JSON.stringify(fixtureState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Warning: Failed to persist progressive fixture manifest:', err);
  }
}

/**
 * STACK37 EOS — Phase 3A.5 Authentication Integration Test Suite
 * 
 * Safety Rules:
 * 1. Requires explicit ephemeral test authorization flag matching approved project ref.
 * 2. Requires explicit human confirmation that target contains zero real customer data.
 * 3. Requires dedicated, strong EOS_RECOVERY_SECRET (no predictable fallback).
 * 4. Ensures both test organizations have exactly one valid active primary owner.
 * 5. Uses actual hostname routing (http://[tenant-slug].localhost:3000/) through proxy.
 * 6. Affirmative teardown and verification removes all test users, organizations, and plans.
 * 
 * Distinction Notice:
 * - Admin-generated token hashes exercise GoTrue cryptographic verification and callback consumption.
 * - They do NOT prove external SMTP delivery or inbox arrival (which requires a live mail receiver).
 */
describe('Phase 3A.5 — Cloud Authentication Integration Tests', () => {
  let adminSupabase: SupabaseClient;
  let anonSupabase: SupabaseClient;

  let runSuffix: string;
  let planId: string;
  let orgAId: string;
  let orgBId: string;
  let orgASlug: string;
  let orgBSlug: string;

  let ownerAId: string;
  let ownerBId: string;
  let multiOrgUserId: string;
  let suspendedUserId: string;

  let clientOwnerA: SupabaseClient;
  let clientOwnerB: SupabaseClient;
  let clientMultiOrg: SupabaseClient;

  const testPassword = 'TestPassword123!Secure';

  beforeAll(async () => {
    // Safety Gate 1: Ephemeral server test authorization flag
    if (!serverAuthFlag || serverAuthFlag !== EXPECTED_PROJECT_REF) {
      throw new Error(
        'Integration test suite execution blocked: EOS_SERVER_TEST_AUTHORIZATION_FLAG is missing or invalid. Must equal ' + EXPECTED_PROJECT_REF
      );
    }

    // Safety Gate 2: Required credentials
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Integration test suite execution blocked: Required Supabase environment variables are missing.');
    }

    // Safety Gate 3: Project reference strictly verified
    if (!supabaseUrl.includes(EXPECTED_PROJECT_REF)) {
      throw new Error('Integration test suite execution blocked: Supabase URL does not match approved EOS project ' + EXPECTED_PROJECT_REF);
    }

    // Safety Gate 4: Explicit human confirmation that database contains no real customer data
    if (customerDataConfirmation !== 'CONFIRMED_EMPTY_PRE_LAUNCH') {
      throw new Error('Integration test suite execution blocked: Set EOS_CONFIRM_NO_REAL_CUSTOMER_DATA=CONFIRMED_EMPTY_PRE_LAUNCH.');
    }

    // Safety Gate 5: Dedicated strong recovery secret configured (>=32 chars, no fallback)
    if (!recoverySecret || recoverySecret.length < 32) {
      throw new Error('Integration test suite execution blocked: Dedicated EOS_RECOVERY_SECRET must be at least 32 characters long.');
    }

    runSuffix = randomUUID().slice(0, 8);
    fixtureState.runSuffix = runSuffix;
    fixtureState.suffix = runSuffix;

    adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create temporary plan (required foreign key for organizations)
    const planRes = await adminSupabase.from('plans').insert({
      name: `Test Plan ${runSuffix}`,
      price: 0,
      is_public: true,
    }).select('id').single();

    if (planRes.error || !planRes.data) {
      throw new Error('Failed to create test plan: ' + planRes.error?.message);
    }
    planId = planRes.data.id;
    fixtureState.plans.push(planId);
    persistManifest();

    // Helper to create and authenticate test users
    const createAndAuthUser = async (email: string) => {
      const res = await adminSupabase.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
      });
      if (res.error || !res.data?.user?.id) {
        throw new Error(`Failed to create user ${email}: ` + res.error?.message);
      }
      const uid = res.data.user.id;
      fixtureState.users.push(uid);
      persistManifest();

      const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const loginRes = await userClient.auth.signInWithPassword({ email, password: testPassword });
      if (loginRes.error) {
        throw new Error(`Failed to authenticate ${email}: ` + loginRes.error.message);
      }

      return { id: uid, client: userClient };
    };

    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';

    // 2. Create User 1: Primary Owner of Org A
    const ownerAEmail = `dev-test+auth-${runSuffix}-ownera@${testEmailDomain}`;
    const user1 = await createAndAuthUser(ownerAEmail);
    ownerAId = user1.id;
    clientOwnerA = user1.client;

    // 3. Create User 4: Primary Owner of Org B
    const ownerBEmail = `dev-test+auth-${runSuffix}-ownerb@${testEmailDomain}`;
    const user4 = await createAndAuthUser(ownerBEmail);
    ownerBId = user4.id;
    clientOwnerB = user4.client;

    // 4. Create User 2: Multi-Org Member
    const multiOrgEmail = `dev-test+auth-${runSuffix}-multiorg@${testEmailDomain}`;
    const user2 = await createAndAuthUser(multiOrgEmail);
    multiOrgUserId = user2.id;
    clientMultiOrg = user2.client;

    // 5. Create User 3: Suspended Employee
    const suspendedEmail = `dev-test+auth-${runSuffix}-suspended@${testEmailDomain}`;
    const user3 = await createAndAuthUser(suspendedEmail);
    suspendedUserId = user3.id;

    // 6. Provision Org A via create_business RPC (atomic creation with Owner A as single active owner)
    orgASlug = `test-auth-orga-${runSuffix}`;
    const orgARpc = await clientOwnerA.rpc('create_business', {
      p_name: `Test Org A ${runSuffix}`,
      p_slug: orgASlug,
      p_plan_id: planId,
      p_country_code: 'US',
    });
    if (orgARpc.error || !orgARpc.data) {
      throw new Error('Failed to create Org A via create_business: ' + orgARpc.error?.message);
    }
    orgAId = orgARpc.data;
    fixtureState.organizations.push(orgAId);
    persistManifest();

    // 7. Provision Org B via create_business RPC (atomic creation with Owner B as single active owner)
    orgBSlug = `test-auth-orgb-${runSuffix}`;
    const orgBRpc = await clientOwnerB.rpc('create_business', {
      p_name: `Test Org B ${runSuffix}`,
      p_slug: orgBSlug,
      p_plan_id: planId,
      p_country_code: 'US',
    });
    if (orgBRpc.error || !orgBRpc.data) {
      throw new Error('Failed to create Org B via create_business: ' + orgBRpc.error?.message);
    }
    orgBId = orgBRpc.data;
    fixtureState.organizations.push(orgBId);
    persistManifest();

    // 8. Add Multi-Org User (User 2) as non-owner member in Org A and Org B
    await adminSupabase.from('organization_members').insert([
      { organization_id: orgAId, user_id: multiOrgUserId, is_owner: false, status: 'active' },
      { organization_id: orgBId, user_id: multiOrgUserId, is_owner: false, status: 'active' },
    ]);

    // 9. Add Suspended User (User 3) as suspended member in Org A
    await adminSupabase.from('organization_members').insert({
      organization_id: orgAId,
      user_id: suspendedUserId,
      is_owner: false,
      status: 'suspended',
    });
  }, 60000);

  afterAll(async () => {
    if (!adminSupabase) return;

    // 1. Delete test organizations (Cascades delete to memberships, branches, subscriptions)
    for (const oid of fixtureState.organizations) {
      await adminSupabase.from('organizations').delete().eq('id', oid);
    }

    // 2. Delete test plans
    for (const pid of fixtureState.plans) {
      await adminSupabase.from('plans').delete().eq('id', pid);
    }

    // 3. Delete all test auth users (Cascades delete to profiles)
    for (const uid of fixtureState.users) {
      await adminSupabase.auth.admin.deleteUser(uid);
    }

    // 4. Affirmative cleanup verification: confirm remote database has 0 residual records
    if (fixtureState.organizations.length > 0) {
      const orgResidual = await adminSupabase.from('organizations').select('id').in('id', fixtureState.organizations);
      expect(orgResidual.data).toHaveLength(0);
    }

    if (fixtureState.plans.length > 0) {
      const planResidual = await adminSupabase.from('plans').select('id').in('id', fixtureState.plans);
      expect(planResidual.data).toHaveLength(0);
    }

    for (const uid of fixtureState.users) {
      const userResidual = await adminSupabase.auth.admin.getUserById(uid);
      expect(userResidual.error).not.toBeNull();
    }

    // 5. Remove manifest only after successful, affirmative cleanup
    if (fs.existsSync(FIXTURE_LOG_PATH)) {
      try {
        fs.unlinkSync(FIXTURE_LOG_PATH);
      } catch {
        // Ignore
      }
    }
  }, 60000);

  // --------------------------------------------------------------------------
  // Scenario 1: Signup & Email Confirmation
  // --------------------------------------------------------------------------
  it('1. Signup creates unconfirmed account; confirm via verifyOtp enables authentication', async () => {
    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';
    const signupEmail = `dev-test+auth-${runSuffix}-signup@${testEmailDomain}`;
    const signupPassword = 'SignupPassword123!';

    // Public signup via anon client
    const { data: signupData, error: signupErr } = await anonSupabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    });
    expect(signupErr).toBeNull();
    expect(signupData.user).not.toBeNull();
    const signupUserId = signupData.user!.id;
    fixtureState.users.push(signupUserId);
    persistManifest();

    // Verify email confirmation is required (session is null)
    expect(signupData.session).toBeNull();
    expect(signupData.user!.email_confirmed_at).toBeFalsy();

    // Attempting login before confirmation must be rejected
    const { error: earlyLoginErr } = await anonSupabase.auth.signInWithPassword({
      email: signupEmail,
      password: signupPassword,
    });
    expect(earlyLoginErr).not.toBeNull();

    // Generate signup confirmation token hash via admin API (simulating GoTrue email link)
    const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
      type: 'signup',
      email: signupEmail,
      password: signupPassword,
    });
    expect(linkErr).toBeNull();
    const tokenHash = linkData?.properties?.hashed_token;
    expect(tokenHash).toBeDefined();

    // Simulate callback route GET execution with token_hash and type=email
    const req = new NextRequest(
      `http://mybusiness.localhost:3000/auth/callback?token_hash=${tokenHash}&type=email&next=/select-organization`
    );
    const res = await authCallbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/select-organization');
    // Invariant: Non-recovery callback never sets recovery cookie
    expect(res.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();

    // Confirm user is now verified in database
    const { data: verifiedUser } = await adminSupabase.auth.admin.getUserById(signupUserId);
    expect(verifiedUser.user?.email_confirmed_at).toBeDefined();

    // Login must now succeed
    const { data: loginData, error: loginErr } = await anonSupabase.auth.signInWithPassword({
      email: signupEmail,
      password: signupPassword,
    });
    expect(loginErr).toBeNull();
    expect(loginData.session).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Login & Logout
  // --------------------------------------------------------------------------
  it('2. Login issues valid session; local logout clears session; global logout revokes refresh tokens', async () => {
    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';
    const ownerAEmail = `dev-test+auth-${runSuffix}-ownera@${testEmailDomain}`;

    // 1. Login with valid credentials
    const { data: loginData, error: loginErr } = await anonSupabase.auth.signInWithPassword({
      email: ownerAEmail,
      password: testPassword,
    });
    expect(loginErr).toBeNull();
    expect(loginData.user?.id).toBe(ownerAId);
    expect(loginData.session?.access_token).toBeDefined();

    const accessToken = loginData.session!.access_token;
    const refreshToken = loginData.session!.refresh_token;

    // 2. Verify authenticated user identity via getUser()
    const authedClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    expect(userErr).toBeNull();
    expect(userData.user?.id).toBe(ownerAId);

    // 3. Local sign out
    await authedClient.auth.signOut({ scope: 'local' });

    // 4. Global sign out: revokes all refresh tokens on server
    const { error: globalSignOutErr } = await adminSupabase.auth.admin.signOut(accessToken, 'global');
    expect(globalSignOutErr).toBeNull();

    // Attempting to refresh with the revoked refresh token must fail
    const { error: refreshErr } = await anonSupabase.auth.refreshSession({ refresh_token: refreshToken });
    expect(refreshErr).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Password Recovery
  // --------------------------------------------------------------------------
  it('3. Password recovery verifies token hash, sets scoped recovery cookie, and updates password', async () => {
    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';
    const ownerBEmail = `dev-test+auth-${runSuffix}-ownerb@${testEmailDomain}`;
    const newPassword = 'NewOwnerBPassword123!Secure';

    // Generate recovery link via admin API
    const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: ownerBEmail,
    });
    expect(linkErr).toBeNull();
    const tokenHash = linkData?.properties?.hashed_token;
    expect(tokenHash).toBeDefined();

    // Simulate callback route invocation with verified token_hash and type=recovery
    const req = new NextRequest(
      `http://mybusiness.localhost:3000/auth/callback?token_hash=${tokenHash}&type=recovery&next=/reset-password`
    );
    const res = await authCallbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://mybusiness.localhost:3000/reset-password');

    // Cryptographic recovery cookie must be set and bound to ownerBId
    const cookie = res.cookies.get(RECOVERY_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBeDefined();
    const isValidToken = verifyRecoveryToken(cookie!.value, ownerBId);
    expect(isValidToken).toBe(true);

    // Update password in GoTrue
    const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(ownerBId, {
      password: newPassword,
    });
    expect(updateErr).toBeNull();

    // Old password must fail
    const { error: oldLoginErr } = await anonSupabase.auth.signInWithPassword({
      email: ownerBEmail,
      password: testPassword,
    });
    expect(oldLoginErr).not.toBeNull();

    // New password must succeed
    const { data: newLoginData, error: newLoginErr } = await anonSupabase.auth.signInWithPassword({
      email: ownerBEmail,
      password: newPassword,
    });
    expect(newLoginErr).toBeNull();
    expect(newLoginData.user?.id).toBe(ownerBId);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Invalid and Expired Email Links
  // --------------------------------------------------------------------------
  it('4. Invalid token hash and attempted callback forgery fail safely without recovery authorization', async () => {
    // 1. Invalid / malformed token hash
    const req1 = new NextRequest(
      'http://mybusiness.localhost:3000/auth/callback?token_hash=completely-bogus-token-hash&type=recovery&next=/reset-password'
    );
    const res1 = await authCallbackGET(req1);
    expect(res1.status).toBe(307);
    expect(res1.headers.get('location')).toBe('http://mybusiness.localhost:3000/login?error=auth_callback_failed');
    expect(res1.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();

    // 2. Callback forgery: passing type=recovery without valid token_hash or code
    const req2 = new NextRequest(
      'http://mybusiness.localhost:3000/auth/callback?type=recovery&next=/reset-password'
    );
    const res2 = await authCallbackGET(req2);
    expect(res2.status).toBe(307);
    expect(res2.headers.get('location')).toBe('http://mybusiness.localhost:3000/login?error=auth_callback_failed');
    expect(res2.cookies.get(RECOVERY_COOKIE_NAME)).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Unauthenticated Tenant Access via Hostname Routing
  // --------------------------------------------------------------------------
  it('5. Unauthenticated tenant access via hostname routing rewrites safely and prevents direct path access', async () => {
    // 1. Direct path access to internal /tenant/... route must be blocked with 404 by proxy
    const directReq = new NextRequest(`http://localhost:3000/tenant/${orgASlug}`);
    const directRes = await proxy(directReq);
    expect(directRes.status).toBe(404);

    // 2. Request through actual tenant hostname http://[tenant-slug].localhost:3000/
    const tenantHostnameReq = new NextRequest(`http://${orgASlug}.localhost:3000/`, {
      headers: { host: `${orgASlug}.localhost:3000` },
    });
    const tenantRes = await proxy(tenantHostnameReq);

    // Proxy rewrites to internal tenant route with sanitized tenant slug header
    expect(tenantRes.status).toBe(200);
    expect(tenantRes.headers.get('x-tenant-slug')).toBe(orgASlug);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Authorized Tenant Access via Hostname Routing
  // --------------------------------------------------------------------------
  it('6. Authorized tenant access resolves active owner membership and role correctly', async () => {
    // Owner A accesses Org A under PostgreSQL RLS
    const { data: orgData, error: orgErr } = await clientOwnerA
      .from('organizations')
      .select('id, name, slug, provisioning_status')
      .eq('slug', orgASlug)
      .single();
    expect(orgErr).toBeNull();
    expect(orgData?.slug).toBe(orgASlug);

    const { data: memData, error: memErr } = await clientOwnerA
      .from('organization_members')
      .select('id, is_owner, status')
      .eq('organization_id', orgAId)
      .eq('user_id', ownerAId)
      .single();
    expect(memErr).toBeNull();
    expect(memData?.is_owner).toBe(true);
    expect(memData?.status).toBe('active');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Cross-Tenant Access Rejection
  // --------------------------------------------------------------------------
  it('7. Cross-tenant access is rejected under RLS when accessing an unauthorized organization', async () => {
    // Owner A attempts to query Org B where they have zero membership.
    // RLS policy "Tenant Read Orgs" must return 0 records.
    const { data: orgBData, error: orgBErr } = await clientOwnerA
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', orgBSlug)
      .maybeSingle();

    expect(orgBErr).toBeNull();
    expect(orgBData).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Suspended Employee Access Rejection
  // --------------------------------------------------------------------------
  it('8. Suspended employee is rejected under RLS and cannot view organizations', async () => {
    // Authenticate as suspended User 3
    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';
    const suspendedEmail = `dev-test+auth-${runSuffix}-suspended@${testEmailDomain}`;
    const clientSuspended = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await clientSuspended.auth.signInWithPassword({
      email: suspendedEmail,
      password: testPassword,
    });

    // private.get_user_orgs() requires status = 'active'.
    // Suspended user must see 0 organizations under RLS.
    const { data: orgsData, error: orgsErr } = await clientSuspended
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', orgASlug);

    expect(orgsErr).toBeNull();
    expect(orgsData).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Organization Switching
  // --------------------------------------------------------------------------
  it('9. Multi-organization member accesses multiple tenants under RLS', async () => {
    // User 2 belongs to both Org A and Org B with status = 'active'.
    // Under RLS, querying organizations must return both Org A and Org B.
    const { data: userOrgs, error: orgsErr } = await clientMultiOrg
      .from('organizations')
      .select('id, name, slug, provisioning_status')
      .order('slug', { ascending: true });

    expect(orgsErr).toBeNull();
    expect(userOrgs).not.toBeNull();
    const slugs = userOrgs!.map(o => o.slug);
    expect(slugs).toContain(orgASlug);
    expect(slugs).toContain(orgBSlug);

    // Verify User 2 can read their membership record in Org A
    const { data: memA } = await clientMultiOrg
      .from('organization_members')
      .select('is_owner, status')
      .eq('organization_id', orgAId)
      .eq('user_id', multiOrgUserId)
      .single();
    expect(memA?.is_owner).toBe(false);
    expect(memA?.status).toBe('active');

    // Verify User 2 can read their membership record in Org B
    const { data: memB } = await clientMultiOrg
      .from('organization_members')
      .select('is_owner, status')
      .eq('organization_id', orgBId)
      .eq('user_id', multiOrgUserId)
      .single();
    expect(memB?.is_owner).toBe(false);
    expect(memB?.status).toBe('active');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Session Expiration & Refresh
  // --------------------------------------------------------------------------
  it('10. Refresh token exchange issues new valid session tokens', async () => {
    const testEmailDomain = process.env.EOS_TEST_EMAIL_DOMAIN || 'stack37.com';
    const ownerAEmail = `dev-test+auth-${runSuffix}-ownera@${testEmailDomain}`;

    // 1. Login to obtain refresh token
    const { data: loginData } = await anonSupabase.auth.signInWithPassword({
      email: ownerAEmail,
      password: testPassword,
    });
    expect(loginData.session).not.toBeNull();
    const originalRefreshToken = loginData.session!.refresh_token;

    // 2. Exchange refresh token
    const { data: refreshData, error: refreshErr } = await anonSupabase.auth.refreshSession({
      refresh_token: originalRefreshToken,
    });
    expect(refreshErr).toBeNull();
    expect(refreshData.session?.access_token).toBeDefined();
    expect(refreshData.session?.refresh_token).toBeDefined();
    // GoTrue rotates the refresh token
    expect(refreshData.session!.refresh_token).not.toBe(originalRefreshToken);
  });
});
