import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { sendInvitationEmail } from '../../src/lib/email/invitation';

// ============================================================================
// Loopback Safety Guard (Strictly loopback - fail closed on hosted environments)
// ============================================================================
const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const parsedUrl = new URL(LOCAL_SUPABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error(
    `SAFETY ABORT: Integration tests are strictly prohibited against non-loopback URLs! Detected host: ${parsedUrl.hostname}. Local Supabase loopback (127.0.0.1 / localhost) required.`
  );
}

const LOCAL_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

describe('TASK-TEAM-001 — Staff Invitations, Roles & Branch Assignment Local Integration Suite', () => {
  let adminClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let ownerClient: SupabaseClient;
  let adminUserClient: SupabaseClient;
  let memberClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let inviteeClient: SupabaseClient;

  let disposableOrgId: string;
  let disposableOrgSlug: string;
  let foreignOrgId: string;

  let adminRoleId: string;
  let memberRoleId: string;
  let hqBranchId: string;
  let foreignRoleId: string;
  let foreignBranchId: string;

  let ownerMembershipId: string;
  let adminMembershipId: string;
  let memberMembershipId: string;

  const OWNER_EMAIL = 'test@stack37.com';
  const ADMIN_EMAIL = `teamadmin_${Date.now()}@stack37.com`;
  const MEMBER_EMAIL = `teammember_${Date.now()}@stack37.com`;
  const OUTSIDER_EMAIL = `outsider_${Date.now()}@stack37.com`;
  const INVITEE_EMAIL = `invitee_${Date.now()}@stack37.com`;
  const TEST_PASSWORD = 'TestPassword123!Secure';

  let adminUserId: string;
  let memberUserId: string;
  let outsiderUserId: string;
  let inviteeUserId: string;

  beforeAll(async () => {
    adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Create Primary Disposable Organization
    disposableOrgId = crypto.randomUUID();
    disposableOrgSlug = `disptm${Date.now().toString().slice(-8)}`;

    const { error: orgErr } = await adminClient.from('organizations').insert({
      id: disposableOrgId,
      name: 'Disposable Team Org',
      slug: disposableOrgSlug,
      provisioning_status: 'pending',
    });
    if (orgErr) throw new Error(`Failed to create disposable org: ${orgErr.message}`);

    // Create Headquarters Branch
    const { data: hqBranch, error: branchErr } = await adminClient
      .from('branches')
      .insert({
        organization_id: disposableOrgId,
        name: 'Headquarters',
      })
      .select('id')
      .single();
    if (branchErr || !hqBranch) throw new Error(`Failed to create branch: ${branchErr?.message}`);
    hqBranchId = hqBranch.id;

    // Create Administrator Role (system = true)
    const { data: adminRole, error: adminRoleErr } = await adminClient
      .from('roles')
      .insert({
        organization_id: disposableOrgId,
        name: 'Administrator',
        is_system: true,
      })
      .select('id')
      .single();
    if (adminRoleErr || !adminRole) throw new Error(`Failed to create admin role: ${adminRoleErr?.message}`);
    adminRoleId = adminRole.id;

    // Create Member Role (system = false)
    const { data: memRole, error: memRoleErr } = await adminClient
      .from('roles')
      .insert({
        organization_id: disposableOrgId,
        name: 'Member',
        is_system: false,
      })
      .select('id')
      .single();
    if (memRoleErr || !memRole) throw new Error(`Failed to create member role: ${memRoleErr?.message}`);
    memberRoleId = memRole.id;

    // Assign reference permissions to Administrator role
    await adminClient.from('role_permissions').insert([
      { organization_id: disposableOrgId, role_id: adminRoleId, permission_id: 'manage_team' },
      { organization_id: disposableOrgId, role_id: adminRoleId, permission_id: 'manage_invitations' },
      { organization_id: disposableOrgId, role_id: adminRoleId, permission_id: 'audit:read' },
    ]);

    // 2. Setup Primary Owner (test@stack37.com)
    const { data: ownerUser } = await adminClient.from('profiles').select('id').eq('email', OWNER_EMAIL).single();
    if (!ownerUser) throw new Error('Primary owner profile not found.');

    const { data: ownerMem, error: ownerMemErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: disposableOrgId,
        user_id: ownerUser.id,
        is_owner: true,
        status: 'active',
      })
      .select('id')
      .single();
    if (ownerMemErr || !ownerMem) throw new Error(`Failed to create owner membership: ${ownerMemErr?.message}`);
    ownerMembershipId = ownerMem.id;

    await adminClient.from('membership_roles').insert({
      organization_id: disposableOrgId,
      membership_id: ownerMembershipId,
      role_id: adminRoleId,
    });
    await adminClient.from('membership_branches').insert({
      organization_id: disposableOrgId,
      membership_id: ownerMembershipId,
      branch_id: hqBranchId,
    });

    // Mark disposable org provisioning completed
    await adminClient
      .from('organizations')
      .update({ provisioning_status: 'completed' })
      .eq('id', disposableOrgId);

    // 3. Create Foreign Organization (to test isolation & foreign key rejection)
    foreignOrgId = crypto.randomUUID();
    await adminClient.from('organizations').insert({
      id: foreignOrgId,
      name: 'Foreign Org',
      slug: `foreign${Date.now().toString().slice(-8)}`,
      provisioning_status: 'pending',
    });

    // Add owner to foreign org to satisfy check_organization_owner trigger
    await adminClient.from('organization_members').insert({
      organization_id: foreignOrgId,
      user_id: ownerUser.id,
      is_owner: true,
      status: 'active',
    });

    await adminClient
      .from('organizations')
      .update({ provisioning_status: 'completed' })
      .eq('id', foreignOrgId);

    const { data: fBranch } = await adminClient
      .from('branches')
      .insert({ organization_id: foreignOrgId, name: 'Remote Office' })
      .select('id')
      .single();
    foreignBranchId = fBranch!.id;

    const { data: fRole } = await adminClient
      .from('roles')
      .insert({ organization_id: foreignOrgId, name: 'Consultant', is_system: false })
      .select('id')
      .single();
    foreignRoleId = fRole!.id;

    // 4. Provision Dedicated Test Auth Users
    // Admin User
    const { data: createdAdmin, error: adminCreateErr } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (adminCreateErr || !createdAdmin.user) throw new Error(`Create admin user failed: ${adminCreateErr?.message}`);
    adminUserId = createdAdmin.user.id;

    const { data: adminMem } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: disposableOrgId,
        user_id: adminUserId,
        is_owner: false,
        status: 'active',
      })
      .select('id')
      .single();
    adminMembershipId = adminMem!.id;

    await adminClient.from('membership_roles').insert({
      organization_id: disposableOrgId,
      membership_id: adminMembershipId,
      role_id: adminRoleId,
    });
    await adminClient.from('membership_branches').insert({
      organization_id: disposableOrgId,
      membership_id: adminMembershipId,
      branch_id: hqBranchId,
    });

    // Member User
    const { data: createdMember, error: memberCreateErr } = await adminClient.auth.admin.createUser({
      email: MEMBER_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (memberCreateErr || !createdMember.user) throw new Error(`Create member user failed: ${memberCreateErr?.message}`);
    memberUserId = createdMember.user.id;

    const { data: memberMem } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: disposableOrgId,
        user_id: memberUserId,
        is_owner: false,
        status: 'active',
      })
      .select('id')
      .single();
    memberMembershipId = memberMem!.id;

    await adminClient.from('membership_roles').insert({
      organization_id: disposableOrgId,
      membership_id: memberMembershipId,
      role_id: memberRoleId,
    });

    // Outsider User
    const { data: createdOutsider, error: outsiderCreateErr } = await adminClient.auth.admin.createUser({
      email: OUTSIDER_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (outsiderCreateErr || !createdOutsider.user) throw new Error(`Create outsider user failed: ${outsiderCreateErr?.message}`);
    outsiderUserId = createdOutsider.user.id;

    // Invitee User
    const { data: createdInvitee, error: inviteeCreateErr } = await adminClient.auth.admin.createUser({
      email: INVITEE_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (inviteeCreateErr || !createdInvitee.user) throw new Error(`Create invitee user failed: ${inviteeCreateErr?.message}`);
    inviteeUserId = createdInvitee.user.id;

    // 5. Authenticate Client Sessions
    ownerClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await ownerClient.auth.signInWithPassword({ email: OWNER_EMAIL, password: TEST_PASSWORD });

    adminUserClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await adminUserClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: TEST_PASSWORD });

    memberClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await memberClient.auth.signInWithPassword({ email: MEMBER_EMAIL, password: TEST_PASSWORD });

    outsiderClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await outsiderClient.auth.signInWithPassword({ email: OUTSIDER_EMAIL, password: TEST_PASSWORD });

    inviteeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await inviteeClient.auth.signInWithPassword({ email: INVITEE_EMAIL, password: TEST_PASSWORD });
  });

  afterAll(async () => {
    // Deterministic Cleanup
    if (disposableOrgId) {
      await adminClient.from('organizations').delete().eq('id', disposableOrgId);
    }
    if (foreignOrgId) {
      await adminClient.from('organizations').delete().eq('id', foreignOrgId);
    }
    if (adminUserId) await adminClient.auth.admin.deleteUser(adminUserId);
    if (memberUserId) await adminClient.auth.admin.deleteUser(memberUserId);
    if (outsiderUserId) await adminClient.auth.admin.deleteUser(outsiderUserId);
    if (inviteeUserId) await adminClient.auth.admin.deleteUser(inviteeUserId);
  });

  // =========================================================================
  // Section 1: Create Invitation RPC Verification
  // =========================================================================
  describe('create_invitation RPC', () => {
    it('allows Primary Owner to issue an invitation to a new staff member', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inviteId, error } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'newstaff1@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).toBeNull();
      expect(inviteId).toBeDefined();

      // Verify row persisted
      const { data: inviteRow } = await adminClient.from('invitations').select('*').eq('id', inviteId).single();
      expect(inviteRow).not.toBeNull();
      expect(inviteRow.email).toBe('newstaff1@stack37.com');
      expect(inviteRow.status).toBe('pending');
      expect(inviteRow.token_hash).toBe(tokenHash);

      // Verify audit log
      const { data: auditLog } = await adminClient
        .from('audit_logs')
        .select('*')
        .eq('organization_id', disposableOrgId)
        .eq('action', 'team.member_invited')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog).not.toBeNull();
      expect(auditLog.payload.email).toBe('newstaff1@stack37.com');
      expect(auditLog.payload.token_hash).toBeUndefined(); // Secrets stripped
    });

    it('allows Administrator with manage_team & manage_invitations to issue an invitation', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inviteId, error } = await adminUserClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'newstaff2@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).toBeNull();
      expect(inviteId).toBeDefined();
    });

    it('prevents Administrator from assigning system Administrator role (privilege escalation guard)', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Administrator attempts to invite another Administrator (is_system = true)
      const { error } = await adminUserClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'escalation@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: adminRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Caller cannot assign the requested role');
    });

    it('rejects invitation attempts from regular Member role', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await memberClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'unauthorized1@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Unauthorized');
    });

    it('rejects invitation attempts from outsider user', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await outsiderClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'unauthorized2@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Unauthorized');
    });

    it('rejects unauthenticated/anon callers (fails closed)', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await anonClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'anon@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).not.toBeNull();
    });

    it('rejects foreign role and foreign branch identifiers', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Foreign role
      const { error: roleErr } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'foreignrole@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: foreignRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });
      expect(roleErr).not.toBeNull();
      expect(roleErr?.message).toContain('selected role does not exist');

      // Foreign branch
      const { error: branchErr } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'foreignbranch@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: foreignBranchId,
        p_expires_at: expiresAt,
      });
      expect(branchErr).not.toBeNull();
      expect(branchErr?.message).toContain('selected operating branch does not exist');
    });

    it('rejects invitations to users who are already active members', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: ADMIN_EMAIL, // already active member
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('already an active team member');
    });

    it('rotates previous pending invitation when re-inviting the same email', async () => {
      const email = 'reinvite@stack37.com';
      const token1 = randomBytes(32).toString('hex');
      const tokenHash1 = hashToken(token1);
      const token2 = randomBytes(32).toString('hex');
      const tokenHash2 = hashToken(token2);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // First invite
      const { data: id1 } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: email,
        p_token_hash: tokenHash1,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      // Second invite (re-invitation)
      const { data: id2 } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: email,
        p_token_hash: tokenHash2,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      expect(id1).not.toBe(id2);

      // Verify prior invite status is 'revoked' and new invite is 'pending'
      const { data: invite1 } = await adminClient.from('invitations').select('status').eq('id', id1).single();
      const { data: invite2 } = await adminClient.from('invitations').select('status').eq('id', id2).single();

      expect(invite1?.status).toBe('revoked');
      expect(invite2?.status).toBe('pending');
    });
  });

  // =========================================================================
  // Section 2: Public Token Lookup (get_invitation_details)
  // =========================================================================
  describe('get_invitation_details RPC', () => {
    it('allows unauthenticated anon caller to read valid invitation details by token_hash', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inviteId } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'lookup_test@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      // Public call via anonClient
      const { data, error } = await anonClient.rpc('get_invitation_details', {
        p_token_hash: tokenHash,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(inviteId);
      expect(data.email).toBe('lookup_test@stack37.com');
      expect(data.organization_name).toBe('Disposable Team Org');
      expect(data.organization_slug).toBe(disposableOrgSlug);
      expect(data.role_name).toBe('Member');
      expect(data.branch_name).toBe('Headquarters');
      expect(data.token_hash).toBeUndefined(); // Secret hash must not be exposed
    });

    it('rejects invalid, short, non-existent, or expired tokens', async () => {
      // Short token
      const { error: shortErr } = await anonClient.rpc('get_invitation_details', {
        p_token_hash: 'short',
      });
      expect(shortErr).not.toBeNull();

      // Non-existent token
      const { error: notFoundErr } = await anonClient.rpc('get_invitation_details', {
        p_token_hash: 'a'.repeat(64),
      });
      expect(notFoundErr).not.toBeNull();
      expect(notFoundErr?.message).toContain('invalid or does not exist');
    });

    it('confirms direct table SELECT on invitations by anon client fails closed with permission denied (42501)', async () => {
      const { data, error } = await anonClient.from('invitations').select('*');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });
  });

  // =========================================================================
  // Section 3: Atomic Acceptance (accept_invitation RPC)
  // =========================================================================
  describe('accept_invitation RPC (Atomic ACID)', () => {
    let acceptToken: string;
    let acceptTokenHash: string;

    beforeAll(async () => {
      acceptToken = randomBytes(32).toString('hex');
      acceptTokenHash = hashToken(acceptToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: INVITEE_EMAIL,
        p_token_hash: acceptTokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });
    });

    it('rejects acceptance if caller email does not match invitation recipient', async () => {
      // Outsider attempts to claim invitation issued to INVITEE_EMAIL
      const { error } = await outsiderClient.rpc('accept_invitation', {
        p_token_hash: acceptTokenHash,
        p_user_id: outsiderUserId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('This invitation was issued to');
    });

    it('atomically claims invitation and provisions member, role, and branch for intended recipient', async () => {
      const { data, error } = await inviteeClient.rpc('accept_invitation', {
        p_token_hash: acceptTokenHash,
        p_user_id: inviteeUserId,
        p_full_name: 'Verified Invitee',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.organization_id).toBe(disposableOrgId);
      expect(data.organization_slug).toBe(disposableOrgSlug);
      expect(data.membership_id).toBeDefined();

      const newMemId = data.membership_id;

      // 1. Verify invitation updated to 'accepted'
      const { data: inviteRow } = await adminClient
        .from('invitations')
        .select('status, accepted_at')
        .eq('token_hash', acceptTokenHash)
        .single();
      expect(inviteRow?.status).toBe('accepted');
      expect(inviteRow?.accepted_at).not.toBeNull();

      // 2. Verify organization_members created with is_owner = false (DEC-010 invariant)
      const { data: memRow } = await adminClient
        .from('organization_members')
        .select('*')
        .eq('id', newMemId)
        .single();
      expect(memRow?.user_id).toBe(inviteeUserId);
      expect(memRow?.is_owner).toBe(false);
      expect(memRow?.status).toBe('active');

      // 3. Verify membership_roles created
      const { data: roleRow } = await adminClient
        .from('membership_roles')
        .select('*')
        .eq('membership_id', newMemId)
        .single();
      expect(roleRow?.role_id).toBe(memberRoleId);

      // 4. Verify membership_branches created
      const { data: branchRow } = await adminClient
        .from('membership_branches')
        .select('*')
        .eq('membership_id', newMemId)
        .single();
      expect(branchRow?.branch_id).toBe(hqBranchId);

      // 5. Verify audit log entry
      const { data: auditRow } = await adminClient
        .from('audit_logs')
        .select('*')
        .eq('organization_id', disposableOrgId)
        .eq('action', 'team.invitation_accepted')
        .single();
      expect(auditRow).not.toBeNull();
      expect(auditRow.payload.membership_id).toBe(newMemId);
    });

    it('enforces single-use replay protection: rejecting subsequent accept attempts', async () => {
      // Attempt to re-accept already-accepted token
      const { error } = await inviteeClient.rpc('accept_invitation', {
        p_token_hash: acceptTokenHash,
        p_user_id: inviteeUserId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('already been accepted');
    });

    it('rejects acceptance if invitation has expired', async () => {
      const expiredToken = randomBytes(32).toString('hex');
      const expiredHash = hashToken(expiredToken);
      const pastExpiry = new Date(Date.now() - 3600 * 1000).toISOString();

      await adminClient.from('invitations').insert({
        organization_id: disposableOrgId,
        email: INVITEE_EMAIL,
        token_hash: expiredHash,
        role_id: memberRoleId,
        branch_id: hqBranchId,
        status: 'pending',
        expires_at: pastExpiry,
      });

      const { error } = await inviteeClient.rpc('accept_invitation', {
        p_token_hash: expiredHash,
        p_user_id: inviteeUserId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('This invitation has expired');
    });
  });

  // =========================================================================
  // Section 4: Revocation, Suspend, Reinstate (revoke_staff_access RPC)
  // =========================================================================
  describe('revoke_staff_access RPC', () => {
    it('strictly protects Primary Owner from revocation or modification (DEC-010 invariant)', async () => {
      const { error } = await adminUserClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: ownerMembershipId,
        p_action: 'suspend',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Primary Owner access cannot be revoked');
    });

    it('prevents Administrator from suspending or removing their own account (self-revocation guard)', async () => {
      const { error } = await adminUserClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: adminMembershipId,
        p_action: 'suspend',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('cannot revoke or suspend your own account');
    });

    it('rejects revocation calls from regular Member role', async () => {
      const { error } = await memberClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: adminMembershipId,
        p_action: 'suspend',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Unauthorized');
    });

    it('allows Primary Owner or Administrator to suspend a staff member', async () => {
      const { data, error } = await ownerClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: memberMembershipId,
        p_action: 'suspend',
      });

      expect(error).toBeNull();
      expect(data.status).toBe('suspend');

      // Verify status in DB
      const { data: memberRow } = await adminClient
        .from('organization_members')
        .select('status')
        .eq('id', memberMembershipId)
        .single();
      expect(memberRow?.status).toBe('suspended');
    });

    it('allows Primary Owner or Administrator to reinstate a suspended staff member', async () => {
      const { data, error } = await ownerClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: memberMembershipId,
        p_action: 'reinstate',
      });

      expect(error).toBeNull();
      expect(data.status).toBe('reinstate');

      // Verify status in DB
      const { data: memberRow } = await adminClient
        .from('organization_members')
        .select('status')
        .eq('id', memberMembershipId)
        .single();
      expect(memberRow?.status).toBe('active');
    });

    it('allows Primary Owner or Administrator to remove a staff member (cascading role/branch links)', async () => {
      const { data, error } = await ownerClient.rpc('revoke_staff_access', {
        p_org_id: disposableOrgId,
        p_membership_id: memberMembershipId,
        p_action: 'remove',
      });

      expect(error).toBeNull();
      expect(data.status).toBe('remove');

      // Verify member row is deleted
      const { data: memberRow } = await adminClient
        .from('organization_members')
        .select('id')
        .eq('id', memberMembershipId)
        .maybeSingle();
      expect(memberRow).toBeNull();
    });
  });

  // =========================================================================
  // Section 5: Cancel Invitation RPC
  // =========================================================================
  describe('cancel_invitation RPC', () => {
    it('allows Administrator or Owner to cancel an unaccepted pending invitation', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inviteId } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'to_be_canceled@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });

      const { data, error } = await adminUserClient.rpc('cancel_invitation', {
        p_org_id: disposableOrgId,
        p_invitation_id: inviteId,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);

      // Verify status is revoked
      const { data: inviteRow } = await adminClient
        .from('invitations')
        .select('status')
        .eq('id', inviteId)
        .single();
      expect(inviteRow?.status).toBe('revoked');
    });
  });

  // =========================================================================
  // Section 6: Mailpit Email Delivery Verification
  // =========================================================================
  describe('Mailpit Test Email Capture (Port 54324)', () => {
    it('dispatches invitation email to local Mailpit and verifies message contents', async () => {
      process.env.MAILPIT_URL = 'http://127.0.0.1:54324';

      const emailResult = await sendInvitationEmail({
        to: 'mailpit_test@stack37.com',
        organizationName: 'Disposable Team Org',
        inviterName: 'Test Administrator',
        roleName: 'Member',
        branchName: 'Headquarters',
        actionUrl: 'http://mybusiness.localhost:3000/invite/accept?token=sample123',
        expiryDays: '7 days',
      });

      expect(emailResult.delivered).toBe(true);

      // Query Mailpit API
      const res = await fetch('http://127.0.0.1:54324/api/v1/messages');
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.total).toBeGreaterThanOrEqual(1);

      const captured = data.messages.find(
        (m: { To: Array<{ Address: string }> }) =>
          m.To.some((to) => to.Address === 'mailpit_test@stack37.com')
      );
      expect(captured).toBeDefined();
      expect(captured.Subject).toContain('Disposable Team Org');
      expect(captured.From.Address).toBe('noreply@stack37.com');

      // Cleanup Mailpit messages
      await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' });
    });
  });

  // =========================================================================
  // Section 7: Direct Table Mutation Privilege Enforcement (RPC-Only Mutation Boundary)
  // =========================================================================
  describe('Direct Table Mutation Privilege Enforcement (RPC-Only Mutation Boundary)', () => {
    let testInviteId: string;

    beforeAll(async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await ownerClient.rpc('create_invitation', {
        p_org_id: disposableOrgId,
        p_email: 'direct_write_test@stack37.com',
        p_token_hash: tokenHash,
        p_role_id: memberRoleId,
        p_branch_id: hqBranchId,
        p_expires_at: expiresAt,
      });
      testInviteId = data as string;
    });

    it('rejects direct UPDATE on invitations by authenticated administrator (role escalation bypass attempt)', async () => {
      const { data, error } = await adminUserClient
        .from('invitations')
        .update({ role_id: adminRoleId })
        .eq('id', testInviteId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501'); // PostgreSQL permission denied
      expect(data).toBeNull();
    });

    it('rejects direct INSERT on invitations by authenticated administrator (unverified token bypass attempt)', async () => {
      const { data, error } = await adminUserClient
        .from('invitations')
        .insert({
          organization_id: disposableOrgId,
          email: 'bypassed@stack37.com',
          token_hash: hashToken('direct_insert_attempt'),
          role_id: adminRoleId,
          branch_id: hqBranchId,
          status: 'pending',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct DELETE on invitations by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('invitations')
        .delete()
        .eq('id', testInviteId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct UPDATE on organization_members (identity/scope alteration bypass attempt)', async () => {
      const { data, error } = await adminUserClient
        .from('organization_members')
        .update({ user_id: outsiderUserId, organization_id: foreignOrgId })
        .eq('id', adminMembershipId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct DELETE on organization_members by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('organization_members')
        .delete()
        .eq('id', adminMembershipId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct INSERT on membership_roles by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('membership_roles')
        .insert({
          organization_id: disposableOrgId,
          membership_id: adminMembershipId,
          role_id: adminRoleId,
        })
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct DELETE on membership_roles by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('membership_roles')
        .delete()
        .eq('membership_id', adminMembershipId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct INSERT on membership_branches by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('membership_branches')
        .insert({
          organization_id: disposableOrgId,
          membership_id: adminMembershipId,
          branch_id: hqBranchId,
        })
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('rejects direct DELETE on membership_branches by authenticated administrator', async () => {
      const { data, error } = await adminUserClient
        .from('membership_branches')
        .delete()
        .eq('membership_id', adminMembershipId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      expect(data).toBeNull();
    });
  });
});
