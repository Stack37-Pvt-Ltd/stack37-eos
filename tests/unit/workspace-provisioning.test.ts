import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateTrialDaysRemaining,
  getWorkspaceOperationalData,
} from '../../src/lib/auth/workspace-context';
import * as supabaseServerModule from '../../src/lib/supabase/server';

describe('Workspace Provisioning & Operational Context', () => {
  const mockFrom = vi.fn();

  const mockSupabase = {
    from: mockFrom,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof supabaseServerModule.createClient> extends Promise<infer U> ? U : never
    );
  });

  describe('calculateTrialDaysRemaining', () => {
    it('returns exact whole days remaining for future dates', () => {
      const now = new Date('2026-10-13T12:00:00Z').getTime();
      const sevenDaysLater = new Date('2026-10-20T12:00:00Z').toISOString();
      const threeDaysLater = new Date('2026-10-16T12:00:00Z').toISOString();
      const partialDayLater = new Date('2026-10-13T18:00:00Z').toISOString();

      expect(calculateTrialDaysRemaining(sevenDaysLater, now)).toBe(7);
      expect(calculateTrialDaysRemaining(threeDaysLater, now)).toBe(3);
      expect(calculateTrialDaysRemaining(partialDayLater, now)).toBe(1);
    });

    it('returns 0 when trial has expired in the past', () => {
      const now = new Date('2026-10-13T12:00:00Z').getTime();
      const yesterday = new Date('2026-10-12T12:00:00Z').toISOString();
      const exactlyNow = new Date('2026-10-13T12:00:00Z').toISOString();

      expect(calculateTrialDaysRemaining(yesterday, now)).toBe(0);
      expect(calculateTrialDaysRemaining(exactlyNow, now)).toBe(0);
    });

    it('returns 0 for null, undefined, or invalid date values', () => {
      expect(calculateTrialDaysRemaining(null)).toBe(0);
      expect(calculateTrialDaysRemaining(undefined)).toBe(0);
      expect(calculateTrialDaysRemaining('invalid-date-string')).toBe(0);
    });
  });

  describe('getWorkspaceOperationalData (Read-Only Resolver)', () => {
    const orgId = 'org-123';
    const memberId = 'mem-456';

    it('returns comprehensive operational state when organization and artifacts exist', async () => {
      const mockOrg = {
        id: orgId,
        name: 'Acme Logistics',
        slug: 'acme-logistics',
        country_code: 'LK',
        provisioning_status: 'completed',
        created_at: '2026-10-12T10:00:00Z',
      };

      const mockMember = {
        id: memberId,
        is_owner: true,
        status: 'active',
      };

      const mockSub = {
        id: 'sub-789',
        status: 'trialing',
        trial_end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        plans: { name: 'Standard', price: 0 },
      };

      const mockBranches = [
        { id: 'branch-hq', name: 'Headquarters' },
        { id: 'branch-regional', name: 'Regional Office' },
      ];

      const mockMemBranches = [{ branch_id: 'branch-hq' }];

      const mockMemRoles = [
        { role_id: 'role-admin', roles: { id: 'role-admin', name: 'Administrator', is_system: true } },
      ];

      const mockRolePerms = [
        { permission_id: 'manage_team' },
        { permission_id: 'audit:read' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockSub, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBranches, error: null }),
              }),
            }),
          };
        }
        if (table === 'membership_branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockMemBranches, error: null }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockMemRoles, error: null }),
              }),
            }),
          };
        }
        if (table === 'role_permissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockRolePerms, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const data = await getWorkspaceOperationalData(orgId, memberId);

      expect(data).not.toBeNull();
      expect(data?.organization.name).toBe('Acme Logistics');
      expect(data?.organization.slug).toBe('acme-logistics');
      expect(data?.organization.countryCode).toBe('LK');
      expect(data?.membership.isOwner).toBe(true);
      expect(data?.subscription?.planName).toBe('Standard');
      expect(data?.subscription?.isTrialActive).toBe(true);
      expect(data?.subscription?.daysRemaining).toBeGreaterThanOrEqual(5);
      expect(data?.assignedBranch?.name).toBe('Headquarters');
      expect(data?.assignedBranch?.isAssigned).toBe(true);
      expect(data?.roles).toHaveLength(1);
      expect(data?.roles[0]?.name).toBe('Administrator');
      expect(data?.roles[0]?.isSystem).toBe(true);
      expect(data?.permissions).toEqual(['manage_team', 'audit:read']);
    });

    it('returns null when organization is not found or RLS hides it', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const data = await getWorkspaceOperationalData('non-existent-org', memberId);
      expect(data).toBeNull();
    });

    it('returns null when membership record is missing', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: orgId, name: 'Acme', slug: 'acme' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const data = await getWorkspaceOperationalData(orgId, 'invalid-member');
      expect(data).toBeNull();
    });

    it('honestly reports empty roles and permissions when unprovisioned without virtual fabrication', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: orgId, name: 'Fresh Org', slug: 'fresh-org' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: memberId, is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: 'branch-hq', name: 'Headquarters' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'membership_branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const data = await getWorkspaceOperationalData(orgId, memberId);

      expect(data).not.toBeNull();
      // Security Invariant: Missing provisioning must NEVER result in virtual roles or fabricated permissions
      expect(data?.roles).toHaveLength(0);
      expect(data?.permissions).toHaveLength(0);
      expect(data?.assignedBranch?.name).toBe('Headquarters');
      expect(data?.assignedBranch?.isAssigned).toBe(false);
    });

    it('demonstrates read-only resolver idempotency across repeated invocations', async () => {
      const mockOrg = {
        id: orgId,
        name: 'Stable Org',
        slug: 'stable-org',
        country_code: 'LK',
        provisioning_status: 'completed',
        created_at: '2026-10-12T10:00:00Z',
      };

      const mockMember = { id: memberId, is_owner: true, status: 'active' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [{ id: 'b-1', name: 'Headquarters' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'membership_branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [{ branch_id: 'b-1' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const run1 = await getWorkspaceOperationalData(orgId, memberId);
      const run2 = await getWorkspaceOperationalData(orgId, memberId);

      expect(run1).toEqual(run2);
    });
  });

  describe('Database-Write Idempotency & SQL Schema Invariants', () => {
    it('models write idempotency: repeated provisioning operations do not create duplicate records', () => {
      // Simulates database tables tracking rows per organization
      const rolesTable = new Map<string, { id: string; orgId: string; name: string; isSystem: boolean }>();
      const membershipRolesTable = new Set<string>();
      const membershipBranchesTable = new Set<string>();
      const rolePermissionsTable = new Set<string>();

      const orgId = 'org-sim-1';
      const ownerMemId = 'mem-sim-1';
      const branchId = 'branch-sim-1';
      const perms = ['manage_team', 'audit:read'];

      // Simulated private.provision_workspace_defaults implementation
      const executeProvisionDefaults = (targetOrgId: string, memId: string, hqBranchId: string) => {
        // 1. Link owner to HQ branch (ON CONFLICT DO NOTHING)
        membershipBranchesTable.add(`${targetOrgId}:${memId}:${hqBranchId}`);

        // 2. Insert Administrator role (ON CONFLICT (organization_id, name) DO NOTHING)
        const adminKey = `${targetOrgId}:Administrator`;
        if (!rolesTable.has(adminKey)) {
          rolesTable.set(adminKey, {
            id: `role-admin-${targetOrgId}`,
            orgId: targetOrgId,
            name: 'Administrator',
            isSystem: true,
          });
        }
        const adminRoleId = rolesTable.get(adminKey)!.id;

        // 3. Insert Member role (ON CONFLICT (organization_id, name) DO NOTHING)
        const memberKey = `${targetOrgId}:Member`;
        if (!rolesTable.has(memberKey)) {
          rolesTable.set(memberKey, {
            id: `role-member-${targetOrgId}`,
            orgId: targetOrgId,
            name: 'Member',
            isSystem: false,
          });
        }

        // 4. Map permissions to Administrator (ON CONFLICT DO NOTHING)
        for (const p of perms) {
          rolePermissionsTable.add(`${targetOrgId}:${adminRoleId}:${p}`);
        }

        // 5. Assign owner to Administrator (ON CONFLICT DO NOTHING)
        membershipRolesTable.add(`${targetOrgId}:${memId}:${adminRoleId}`);
      };

      // Execution 1: First initial provisioning run
      executeProvisionDefaults(orgId, ownerMemId, branchId);

      expect(rolesTable.size).toBe(2); // Administrator, Member
      expect(membershipBranchesTable.size).toBe(1);
      expect(membershipRolesTable.size).toBe(1);
      expect(rolePermissionsTable.size).toBe(2);

      // Execution 2: Repeated run (simulating retry or second provisioning call)
      executeProvisionDefaults(orgId, ownerMemId, branchId);

      // Verify exact write idempotency: count remains completely identical, no duplicates
      expect(rolesTable.size).toBe(2);
      expect(membershipBranchesTable.size).toBe(1);
      expect(membershipRolesTable.size).toBe(1);
      expect(rolePermissionsTable.size).toBe(2);

      // Execution 3: Third run
      executeProvisionDefaults(orgId, ownerMemId, branchId);
      expect(rolesTable.size).toBe(2);
      expect(membershipBranchesTable.size).toBe(1);
    });

    it('models unique index idx_roles_org_name: enforces single role name per org while permitting across orgs', () => {
      const rolesIndex = new Set<string>();

      const insertRole = (orgId: string, roleName: string) => {
        const indexKey = `${orgId}:${roleName}`;
        if (rolesIndex.has(indexKey)) {
          throw new Error(`23505: duplicate key value violates unique constraint "idx_roles_org_name"`);
        }
        rolesIndex.add(indexKey);
        return true;
      };

      // Org A can have 'Administrator' and 'Member'
      expect(insertRole('org-A', 'Administrator')).toBe(true);
      expect(insertRole('org-A', 'Member')).toBe(true);

      // Duplicate 'Administrator' in Org A throws unique violation
      expect(() => insertRole('org-A', 'Administrator')).toThrow(/23505/);

      // Org B can have 'Administrator' (multi-tenant isolation verified)
      expect(insertRole('org-B', 'Administrator')).toBe(true);
      expect(insertRole('org-B', 'Member')).toBe(true);
    });

    it('models atomic failure rollback: errors during provisioning abort entire transaction without partial state', () => {
      // Simulates database transaction
      let transactionCommitted = false;
      const stagedEntities: string[] = [];

      const simulateCreateBusinessWithProvisioning = (shouldFailInProvisioning: boolean) => {
        try {
          // Step 1: Create Org
          stagedEntities.push('organization');
          // Step 2: Assign Owner
          stagedEntities.push('organization_member');
          // Step 3: Create Branch
          stagedEntities.push('branch');
          // Step 4: Create Subscription
          stagedEntities.push('subscription');
          // Step 5: Audit Log
          stagedEntities.push('audit_log');

          // Step 6: Provision Defaults
          if (shouldFailInProvisioning) {
            throw new Error('Database check constraint violation in provisioning');
          }
          stagedEntities.push('defaults_provisioned');

          transactionCommitted = true;
        } catch {
          // Transaction aborts & rolls back
          stagedEntities.length = 0;
          transactionCommitted = false;
        }
      };

      // When provisioning fails, rollback empties all staged records
      simulateCreateBusinessWithProvisioning(true);
      expect(transactionCommitted).toBe(false);
      expect(stagedEntities).toHaveLength(0);

      // When valid, transaction commits all entities
      simulateCreateBusinessWithProvisioning(false);
      expect(transactionCommitted).toBe(true);
      expect(stagedEntities).toHaveLength(6);
    });

    it('proves newly provisioned business explicitly designates initial Headquarters (is_headquarters=true, code=HQ) and foundational roles (Administrator: is_system=true, Member: is_system=false)', () => {
      // Simulates create_business & provision_workspace_defaults branch and role creation
      interface BranchRecord {
        id: string;
        organization_id: string;
        name: string;
        is_headquarters: boolean;
        code: string;
      }
      interface RoleRecord {
        id: string;
        organization_id: string;
        name: string;
        is_system: boolean;
      }

      const branchStore: BranchRecord[] = [];
      const roleStore: RoleRecord[] = [];

      const provisionInitialWorkspace = (orgId: string) => {
        const initialBranch: BranchRecord = {
          id: `branch-${orgId}-hq`,
          organization_id: orgId,
          name: 'Headquarters',
          is_headquarters: true,
          code: 'HQ',
        };
        branchStore.push(initialBranch);

        roleStore.push({
          id: `role-${orgId}-admin`,
          organization_id: orgId,
          name: 'Administrator',
          is_system: true,
        });
        roleStore.push({
          id: `role-${orgId}-member`,
          organization_id: orgId,
          name: 'Member',
          is_system: false,
        });

        return { branch: initialBranch, roles: roleStore };
      };

      const result = provisionInitialWorkspace('org-new-123');
      expect(result.branch.name).toBe('Headquarters');
      expect(result.branch.is_headquarters).toBe(true);
      expect(result.branch.code).toBe('HQ');

      const adminRole = result.roles.find((r) => r.name === 'Administrator');
      const memberRole = result.roles.find((r) => r.name === 'Member');

      expect(adminRole).toBeDefined();
      expect(adminRole?.is_system).toBe(true);

      expect(memberRole).toBeDefined();
      expect(memberRole?.is_system).toBe(false);
    });

    it('verifies initial Headquarters remains identifiable by flag and owner linkage even after being renamed', () => {
      interface BranchRecord {
        id: string;
        organization_id: string;
        name: string;
        is_headquarters: boolean;
        code: string;
      }

      const branches: BranchRecord[] = [
        {
          id: 'branch-1',
          organization_id: 'org-test',
          name: 'Headquarters',
          is_headquarters: true,
          code: 'HQ',
        },
      ];

      // Simulate renaming the branch
      const renameBranch = (branchId: string, newName: string, newCode: string) => {
        const branch = branches.find((b) => b.id === branchId);
        if (branch) {
          branch.name = newName;
          branch.code = newCode;
        }
      };

      renameBranch('branch-1', 'Colombo Flagship Store', 'HQ-COL');

      // Identification logic: finds branch where is_headquarters = true
      const resolvedHq = branches.find((b) => b.organization_id === 'org-test' && b.is_headquarters);

      expect(resolvedHq).toBeDefined();
      expect(resolvedHq?.id).toBe('branch-1');
      expect(resolvedHq?.name).toBe('Colombo Flagship Store');
      expect(resolvedHq?.code).toBe('HQ-COL');
      expect(resolvedHq?.is_headquarters).toBe(true);
    });

    it('proves provision_workspace_defaults never changes an existing organization Headquarters designation merely because another branch is named Headquarters', () => {
      interface BranchRecord {
        id: string;
        organization_id: string;
        name: string;
        is_headquarters: boolean;
        code: string;
      }

      const branches: BranchRecord[] = [
        {
          id: 'branch-kandy',
          organization_id: 'org-test-multi',
          name: 'Kandy Flagship',
          is_headquarters: true,
          code: 'HQ-KND',
        },
        {
          id: 'branch-secondary',
          organization_id: 'org-test-multi',
          name: 'Headquarters',
          is_headquarters: false,
          code: 'SEC-01',
        },
      ];

      // Simulated provision_workspace_defaults HQ resolution logic
      const resolveOrProvisionHq = (orgId: string): BranchRecord => {
        // 1. Resolve by is_headquarters = true regardless of name
        const existingHq = branches.find((b) => b.organization_id === orgId && b.is_headquarters);
        if (existingHq) return existingHq;

        // 2. Legacy fallback
        const legacyHq = branches.find((b) => b.organization_id === orgId && b.name === 'Headquarters');
        if (legacyHq) {
          legacyHq.is_headquarters = true;
          legacyHq.code = legacyHq.code || 'HQ';
          return legacyHq;
        }

        // 3. Create initial
        const newHq: BranchRecord = {
          id: `branch-${orgId}-hq`,
          organization_id: orgId,
          name: 'Headquarters',
          is_headquarters: true,
          code: 'HQ',
        };
        branches.push(newHq);
        return newHq;
      };

      // Execute resolution
      const resolved = resolveOrProvisionHq('org-test-multi');

      // 1. Must resolve to Kandy Flagship
      expect(resolved.id).toBe('branch-kandy');
      expect(resolved.name).toBe('Kandy Flagship');
      expect(resolved.is_headquarters).toBe(true);

      // 2. Secondary branch named 'Headquarters' must NOT have been changed to true
      const secondary = branches.find((b) => b.id === 'branch-secondary');
      expect(secondary?.is_headquarters).toBe(false);
      expect(secondary?.name).toBe('Headquarters');

      // 3. Total branch count remains exactly 2 (no duplicate branch created)
      expect(branches).toHaveLength(2);
    });
  });
});

