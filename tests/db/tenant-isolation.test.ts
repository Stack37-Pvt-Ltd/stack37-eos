import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

try {
    if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === 'function' && fs.existsSync('.env.local')) {
        (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile('.env.local');
    }
} catch {
    // Ignore if not present or failing
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serverAuthFlag = process.env.EOS_SERVER_TEST_AUTHORIZATION_FLAG;
const customerDataConfirmation = process.env.EOS_CONFIRM_NO_REAL_CUSTOMER_DATA;

const EXPECTED_PROJECT_REF = 'xbiadendaxhoyrcvaybf';
const FIXTURE_LOG_PATH = path.resolve(__dirname, '.last-run-fixtures.json');

// Progressive Fixture Recovery State
interface FixtureManifest {
    timestamp: string;
    suffix: string;
    projectRef: string;
    organizations: string[];
    plans: string[];
    users: string[];
    roles: string[];
    auditLogIds: string[];
}

const fixtureState: FixtureManifest = {
    timestamp: new Date().toISOString(),
    suffix: '',
    projectRef: EXPECTED_PROJECT_REF,
    organizations: [],
    plans: [],
    users: [],
    roles: [],
    auditLogIds: []
};

function persistManifest() {
    try {
        fs.writeFileSync(FIXTURE_LOG_PATH, JSON.stringify(fixtureState, null, 2), 'utf-8');
    } catch (err) {
        console.error('Warning: Failed to persist progressive fixture manifest:', err);
    }
}

describe('Database RLS and Isolation Tests', () => {
    let supabaseOrgAOwner: SupabaseClient;
    let supabaseOrgAManager: SupabaseClient;
    let supabaseOrgAEmployee: SupabaseClient;
    let supabaseOrgBOwner: SupabaseClient;
    
    let adminSupabase: SupabaseClient;
    
    let orgAId: string;
    let orgBId: string;
    
    let planId: string;
    let privatePlanId: string;
    
    let ownerAId: string;
    let ownerBId: string;
    let managerAId: string;
    let empAId: string;
    
    let ownerAMemId: string;
    let managerAMemId: string;
    let empAMemId: string;
    let ownerBMemId: string;
    
    let sysRoleId: string;
    let mgrRoleId: string;

    beforeAll(async () => {
        // Gate 1: Server test authorization flag
        if (!serverAuthFlag || serverAuthFlag !== EXPECTED_PROJECT_REF) {
            throw new Error('Test suite execution blocked: EOS_SERVER_TEST_AUTHORIZATION_FLAG is missing or invalid.');
        }

        // Gate 2: Required credentials
        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            throw new Error('Test suite execution blocked: Required Supabase environment variables are missing.');
        }

        // Gate 3: Project reference strictly matched
        if (!supabaseUrl.includes(EXPECTED_PROJECT_REF)) {
            throw new Error('Test suite execution blocked: Supabase URL does not match the approved EOS project reference.');
        }

        // Gate 4: Explicit human confirmation that database contains no real customer data
        if (customerDataConfirmation !== 'CONFIRMED_EMPTY_PRE_LAUNCH') {
            throw new Error('Test suite execution blocked: Missing explicit confirmation that database contains no real customer data. Set EOS_CONFIRM_NO_REAL_CUSTOMER_DATA=CONFIRMED_EMPTY_PRE_LAUNCH.');
        }

        adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

        // Gate 5: Programmatic DB inspection - Abort if any organization exists that does not start with 'test-org-'
        const orgCheck = await adminSupabase.from('organizations').select('slug').not('slug', 'ilike', 'test-org-%');
        if (orgCheck.error) throw new Error('Failed to verify DB state: ' + orgCheck.error.message);
        if (orgCheck.data.length > 0) {
            throw new Error('Test aborted: Environment contains non-test organizations. Potentially live customer data.');
        }

        // Gate 6: Verify stable global reference permissions exist from migration 07 without modifying them
        const permCheck = await adminSupabase.from('permissions').select('id').in('id', ['manage_team', 'audit:read']);
        if (permCheck.error) throw new Error('Failed to verify permissions: ' + permCheck.error.message);
        if (permCheck.data.length < 2) {
            throw new Error('Test aborted: Required global permissions (manage_team, audit:read) are missing. Ensure reference migration 07 is deployed.');
        }

        const runSuffix = randomUUID().substring(0, 8);
        fixtureState.suffix = runSuffix;
        persistManifest();

        const ownerAEmail = `ownera-${runSuffix}@test.com`;
        const managerAEmail = `managera-${runSuffix}@test.com`;
        const empAEmail = `empa-${runSuffix}@test.com`;
        const ownerBEmail = `ownerb-${runSuffix}@test.com`;
        const testPass = `Str0ng-Test-Pass!-${runSuffix}`;

        // Create Public Plan - save manifest progressively
        const planRes = await adminSupabase.from('plans').insert({ name: `Test Plan ${runSuffix}`, price: 0, is_public: true }).select('id').single();
        if (planRes.error || !planRes.data?.id) throw new Error('Failed to create plan: ' + planRes.error?.message);
        planId = planRes.data.id;
        fixtureState.plans.push(planId);
        persistManifest();

        // Create Private Plan - save manifest progressively
        const privPlanRes = await adminSupabase.from('plans').insert({ name: `Private Plan ${runSuffix}`, price: 100, is_public: false }).select('id').single();
        if (privPlanRes.error || !privPlanRes.data?.id) throw new Error('Failed to create private plan: ' + privPlanRes.error?.message);
        privatePlanId = privPlanRes.data.id;
        fixtureState.plans.push(privatePlanId);
        persistManifest();

        // Provision Auth Users - save manifest progressively per user created
        const createUser = async (email: string) => {
            const res = await adminSupabase.auth.admin.createUser({ email, password: testPass, email_confirm: true });
            if (res.error || !res.data?.user?.id) throw new Error(`Failed to create user ${email}: ` + res.error?.message);
            const uid = res.data.user.id;
            fixtureState.users.push(uid);
            persistManifest();

            const client = createClient(supabaseUrl, supabaseAnonKey);
            const authRes = await client.auth.signInWithPassword({ email, password: testPass });
            if (authRes.error) throw new Error(`Auth failed for ${email}: ` + authRes.error.message);
            return { client, id: uid };
        };

        const ownerA = await createUser(ownerAEmail);
        supabaseOrgAOwner = ownerA.client;
        ownerAId = ownerA.id;
        
        const managerA = await createUser(managerAEmail);
        supabaseOrgAManager = managerA.client;
        managerAId = managerA.id;

        const empA = await createUser(empAEmail);
        supabaseOrgAEmployee = empA.client;
        empAId = empA.id;

        const ownerB = await createUser(ownerBEmail);
        supabaseOrgBOwner = ownerB.client;
        ownerBId = ownerB.id;

        // Provision Org A via RPC - save manifest progressively
        const orgARes = await supabaseOrgAOwner.rpc('create_business', { p_name: 'Test Org A', p_slug: `test-org-a-${runSuffix}`, p_plan_id: planId, p_country_code: 'US' });
        if (orgARes.error || !orgARes.data) throw new Error('Failed to create Org A: ' + orgARes.error?.message);
        orgAId = orgARes.data;
        fixtureState.organizations.push(orgAId);
        persistManifest();

        // Fetch Owner A's exact membership ID
        const ownerAMem = await adminSupabase.from('organization_members').select('id').eq('organization_id', orgAId).eq('user_id', ownerAId).single();
        if (ownerAMem.error || !ownerAMem.data?.id) throw new Error('Failed to fetch Owner A mem: ' + ownerAMem.error?.message);
        ownerAMemId = ownerAMem.data.id;

        // Provision Org B via RPC - save manifest progressively
        const orgBRes = await supabaseOrgBOwner.rpc('create_business', { p_name: 'Test Org B', p_slug: `test-org-b-${runSuffix}`, p_plan_id: planId, p_country_code: 'US' });
        if (orgBRes.error || !orgBRes.data) throw new Error('Failed to create Org B: ' + orgBRes.error?.message);
        orgBId = orgBRes.data;
        fixtureState.organizations.push(orgBId);
        persistManifest();

        const ownerBMem = await adminSupabase.from('organization_members').select('id').eq('organization_id', orgBId).eq('user_id', ownerBId).single();
        if (ownerBMem.error || !ownerBMem.data?.id) throw new Error('Failed to fetch Owner B mem: ' + ownerBMem.error?.message);
        ownerBMemId = ownerBMem.data.id;

        // Create Roles for Org A - save manifest progressively
        const sysRoleRes = await adminSupabase.from('roles').insert({ organization_id: orgAId, name: 'System Admin', is_system: true }).select('id').single();
        if (sysRoleRes.error || !sysRoleRes.data?.id) throw new Error('Failed to create sys role: ' + sysRoleRes.error?.message);
        sysRoleId = sysRoleRes.data.id;
        fixtureState.roles.push(sysRoleId);
        persistManifest();

        const mgrRoleRes = await adminSupabase.from('roles').insert({ organization_id: orgAId, name: 'Manager', is_system: false }).select('id').single();
        if (mgrRoleRes.error || !mgrRoleRes.data?.id) throw new Error('Failed to create mgr role: ' + mgrRoleRes.error?.message);
        mgrRoleId = mgrRoleRes.data.id;
        fixtureState.roles.push(mgrRoleId);
        persistManifest();

        // Grant exact permissions to Manager Role and verify result
        const rpInsertRes = await adminSupabase.from('role_permissions').insert([
            { organization_id: orgAId, role_id: mgrRoleId, permission_id: 'manage_team' },
            { organization_id: orgAId, role_id: mgrRoleId, permission_id: 'audit:read' }
        ]).select();
        if (rpInsertRes.error) throw new Error('Failed to insert role_permissions: ' + rpInsertRes.error.message);
        if (!rpInsertRes.data || rpInsertRes.data.length !== 2) throw new Error('Failed to verify role_permissions insert count');

        // Add Manager and Employee to Org A and verify result
        const memMgrRes = await adminSupabase.from('organization_members').insert({ organization_id: orgAId, user_id: managerAId }).select('id').single();
        if (memMgrRes.error || !memMgrRes.data?.id) throw new Error('Failed to add manager: ' + memMgrRes.error?.message);
        managerAMemId = memMgrRes.data.id;

        const memEmpRes = await adminSupabase.from('organization_members').insert({ organization_id: orgAId, user_id: empAId }).select('id').single();
        if (memEmpRes.error || !memEmpRes.data?.id) throw new Error('Failed to add employee: ' + memEmpRes.error?.message);
        empAMemId = memEmpRes.data.id;

        // Assign Roles and verify result
        const mrInsertRes = await adminSupabase.from('membership_roles').insert([
            { organization_id: orgAId, membership_id: managerAMemId, role_id: mgrRoleId },
            { organization_id: orgAId, membership_id: empAMemId, role_id: sysRoleId }
        ]).select();
        if (mrInsertRes.error) throw new Error('Failed to assign membership roles: ' + mrInsertRes.error.message);
        if (!mrInsertRes.data || mrInsertRes.data.length !== 2) throw new Error('Failed to verify membership_roles insert count');

        // Explicit Setup Verification: Assert that Manager actually possesses manage_team and audit:read
        const mgrPermsVerification = await adminSupabase
            .from('role_permissions')
            .select('permission_id')
            .eq('organization_id', orgAId)
            .eq('role_id', mgrRoleId);
        if (mgrPermsVerification.error) throw new Error('Failed to verify manager role perms: ' + mgrPermsVerification.error.message);
        const grantedPerms = (mgrPermsVerification.data || []).map((p: { permission_id: string }) => p.permission_id);
        if (!grantedPerms.includes('manage_team') || !grantedPerms.includes('audit:read')) {
            throw new Error('Manager role is missing verified manage_team or audit:read permissions');
        }

        const mgrMemRoleVerification = await adminSupabase
            .from('membership_roles')
            .select('role_id')
            .eq('organization_id', orgAId)
            .eq('membership_id', managerAMemId)
            .eq('role_id', mgrRoleId)
            .single();
        if (mgrMemRoleVerification.error || !mgrMemRoleVerification.data) {
            throw new Error('Manager membership verification failed: role assignment not found');
        }

        // Generate Audit Logs with actor_id - save manifest progressively
        const auditA = await adminSupabase.from('audit_logs').insert([
            { organization_id: orgAId, actor_id: ownerAId, action: 'test', resource: 'test' }
        ]).select('id').single();
        if (auditA.error || !auditA.data?.id) throw new Error('Failed to insert audit A: ' + auditA.error?.message);
        fixtureState.auditLogIds.push(auditA.data.id);
        persistManifest();

        const auditB = await adminSupabase.from('audit_logs').insert([
            { organization_id: orgBId, actor_id: ownerBId, action: 'test', resource: 'test' }
        ]).select('id').single();
        if (auditB.error || !auditB.data?.id) throw new Error('Failed to insert audit B: ' + auditB.error?.message);
        fixtureState.auditLogIds.push(auditB.data.id);
        persistManifest();
    }, 60000);

    afterAll(async () => {
        if (!adminSupabase) return;
        
        // Audit logs intentionally DO NOT have a foreign key to organizations, nor cascade deletion.
        // This guarantees absolute append-only integrity: even if an organization is deleted,
        // its historical audit records are preserved immutably.
        // Test audit records created by this run remain orphaned but retained, reflecting true production behavior.

        // 1. Delete test organizations (Cascades delete branches, memberships, roles, subscriptions, domains)
        for (const oid of fixtureState.organizations) {
            const res = await adminSupabase.from('organizations').delete().eq('id', oid);
            expect(res.error).toBeNull();
        }

        // 2. Delete test plans
        for (const pid of fixtureState.plans) {
            const res = await adminSupabase.from('plans').delete().eq('id', pid);
            expect(res.error).toBeNull();
        }
        
        // 3. Delete test auth users (Cascades delete profiles)
        for (const uid of fixtureState.users) {
            const res = await adminSupabase.auth.admin.deleteUser(uid);
            expect(res.error).toBeNull();
        }

        // 4. Affirmative Cleanup Verification: Query remote database to verify zero fixture residue remains
        if (fixtureState.organizations.length > 0) {
            const orgResidual = await adminSupabase.from('organizations').select('id').in('id', fixtureState.organizations);
            expect(orgResidual.error).toBeNull();
            expect(orgResidual.data).toHaveLength(0);
        }

        if (fixtureState.plans.length > 0) {
            const planResidual = await adminSupabase.from('plans').select('id').in('id', fixtureState.plans);
            expect(planResidual.error).toBeNull();
            expect(planResidual.data).toHaveLength(0);
        }

        for (const uid of fixtureState.users) {
            const userResidual = await adminSupabase.auth.admin.getUserById(uid);
            // Expect user lookup to fail since user was deleted
            expect(userResidual.error).not.toBeNull();
        }

        // 5. Only remove the recovery manifest after successful, verified cleanup
        if (fs.existsSync(FIXTURE_LOG_PATH)) {
            try {
                fs.unlinkSync(FIXTURE_LOG_PATH);
            } catch (err) {
                console.error('Warning: Failed to unlink recovery manifest after verification:', err);
            }
        }
    }, 60000);

    // ==========================================
    // 1. Cross-Tenant Isolation
    // ==========================================
    it('1. Should reject cross-tenant branch assignment', async () => {
        const branchB = await adminSupabase.from('branches').select('id').eq('organization_id', orgBId).single();
        expect(branchB.error).toBeNull();
        expect(branchB.data).not.toBeNull();

        const res = await supabaseOrgAOwner.from('membership_branches').insert({
            organization_id: orgAId,
            membership_id: ownerAMemId,
            branch_id: branchB.data!.id
        });
        expect(res.error).not.toBeNull();
        expect(res.error?.code).toBe('23503'); // Compound Foreign Key Violation
    });

    // ==========================================
    // 2. Audit Visibility Boundaries (Read-Only)
    // ==========================================
    it('2. Employee without audit:read cannot view audit logs', async () => {
        const res = await supabaseOrgAEmployee.from('audit_logs').select('*').eq('organization_id', orgAId);
        expect(res.error).toBeNull();
        expect(res.data).toHaveLength(0); // Blocked by RLS
    });

    it('3. Manager with audit:read can view own organization audit logs', async () => {
        const res = await supabaseOrgAManager.from('audit_logs').select('*').eq('organization_id', orgAId);
        expect(res.error).toBeNull();
        expect(res.data).not.toBeNull();
        expect(res.data!.length).toBeGreaterThan(0); // Allowed by RLS
    });

    it('4. Manager with audit:read cannot view Org B audit logs', async () => {
        const res = await supabaseOrgAManager.from('audit_logs').select('*').eq('organization_id', orgBId);
        expect(res.error).toBeNull();
        expect(res.data).toHaveLength(0); // Blocked by cross-tenant RLS
    });

    // ==========================================
    // 3. Role Delegation and Privilege Escalation
    // ==========================================
    it('5. Should reject removing a system role by a non-owner with manage_team', async () => {
        const deleteAttemptRes = await supabaseOrgAManager.from('membership_roles')
            .delete()
            .eq('organization_id', orgAId)
            .eq('role_id', sysRoleId);
        expect(deleteAttemptRes.error).toBeNull();
            
        // RLS prevents deletion without throwing an exception: verify the role is preserved
        const selectRes = await adminSupabase.from('membership_roles').select('*').eq('role_id', sysRoleId);
        expect(selectRes.error).toBeNull();
        expect(selectRes.data).toHaveLength(1); // Role was NOT deleted
    });

    it('6. Owner should successfully remove the system role', async () => {
        const deleteRes = await supabaseOrgAOwner.from('membership_roles')
            .delete()
            .eq('organization_id', orgAId)
            .eq('role_id', sysRoleId);
        expect(deleteRes.error).toBeNull();
            
        const selectRes = await adminSupabase.from('membership_roles').select('*').eq('role_id', sysRoleId);
        expect(selectRes.error).toBeNull();
        expect(selectRes.data).toHaveLength(0); // Role WAS deleted
    });

    // ==========================================
    // 4. Ownership Invariants (Database Constraint Triggers)
    // ==========================================
    it('7. Should reject creating an active organization directly without an owner via trigger', async () => {
        const testSlug = `test-org-no-owner-${randomUUID().substring(0, 4)}`;
        
        // Executed via adminSupabase (service role, bypassing RLS) to prove rejection is purely from the database trigger
        const res = await adminSupabase.from('organizations').insert({
            name: 'No Owner Org',
            slug: testSlug,
            provisioning_status: 'completed'
        });
        
        // 1. Assert rejection occurred
        expect(res.error).not.toBeNull();
        
        // 2. Distinguish from RLS/syntax/FK: verify PostgreSQL error code P0001 (raise_exception from trigger)
        expect(res.error?.code).toBe('P0001');
        
        // 3. Verify error message is specifically from the check_org_provisioned_owner trigger
        expect(res.error?.message).toMatch(/owner/i);
        
        // 4. Confirm transaction rolled back: organization record was NOT created in database
        const checkOrg = await adminSupabase.from('organizations').select('id').eq('slug', testSlug);
        expect(checkOrg.error).toBeNull();
        expect(checkOrg.data).toHaveLength(0);
    });

    it('8. Should reject removing the only owner and preserve the owner record via trigger', async () => {
        // Executed via adminSupabase (service role, bypassing RLS) to prove rejection is purely from check_organization_owner trigger
        const res = await adminSupabase.from('organization_members').delete().eq('id', ownerAMemId);
        
        // 1. Assert deletion was rejected
        expect(res.error).not.toBeNull();
        
        // 2. Distinguish from RLS/syntax/FK: verify PostgreSQL error code P0001 (raise_exception from trigger)
        expect(res.error?.code).toBe('P0001');
        
        // 3. Verify error message is specifically from the check_organization_owner trigger
        expect(res.error?.message).toMatch(/owner/i);
        
        // 4. Confirm transaction rolled back: owner record is preserved and unchanged
        const ownerCheck = await adminSupabase.from('organization_members')
            .select('id, is_owner, status, organization_id')
            .eq('id', ownerAMemId)
            .single();
        expect(ownerCheck.error).toBeNull();
        expect(ownerCheck.data).not.toBeNull();
        expect(ownerCheck.data!.id).toBe(ownerAMemId);
        expect(ownerCheck.data!.is_owner).toBe(true);
        expect(ownerCheck.data!.status).toBe('active');
        expect(ownerCheck.data!.organization_id).toBe(orgAId);
    });

    it('9. Should reject transferring an owner to another org via one_owner_per_org unique index', async () => {
        // Attempt to transfer Company A's active owner to Company B (which already has an active owner)
        const res = await adminSupabase.from('organization_members').update({ organization_id: orgBId }).eq('id', ownerAMemId);
        
        // 1. Assert update was rejected
        expect(res.error).not.toBeNull();
        
        // 2. Explicitly assert PostgreSQL error 23505 (unique_violation from one_owner_per_org index)
        expect(res.error?.code).toBe('23505');
        expect(res.error?.message).toContain('one_owner_per_org');
        
        // 3. Confirm transaction rolled back: Company A's owner membership is preserved
        const ownerACheck = await adminSupabase.from('organization_members')
            .select('id, organization_id, is_owner, status')
            .eq('id', ownerAMemId)
            .single();
        expect(ownerACheck.error).toBeNull();
        expect(ownerACheck.data).not.toBeNull();
        expect(ownerACheck.data!.id).toBe(ownerAMemId);
        expect(ownerACheck.data!.organization_id).toBe(orgAId);
        expect(ownerACheck.data!.is_owner).toBe(true);
        expect(ownerACheck.data!.status).toBe('active');

        // 4. Confirm Company B's existing owner membership remains unaffected
        const ownerBCheck = await adminSupabase.from('organization_members')
            .select('id, organization_id, is_owner, status')
            .eq('id', ownerBMemId)
            .single();
        expect(ownerBCheck.error).toBeNull();
        expect(ownerBCheck.data).not.toBeNull();
        expect(ownerBCheck.data!.id).toBe(ownerBMemId);
        expect(ownerBCheck.data!.organization_id).toBe(orgBId);
        expect(ownerBCheck.data!.is_owner).toBe(true);
        expect(ownerBCheck.data!.status).toBe('active');
    });
});

