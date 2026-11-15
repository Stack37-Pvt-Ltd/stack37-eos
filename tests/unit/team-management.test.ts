import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  inviteStaffAction,
  getInvitationDetailsAction,
  acceptInvitationAction,
  revokeStaffAccessAction,
  cancelInvitationAction,
  getTeamRoster,
} from '../../src/lib/actions/team';
import {
  generateInvitationToken,
  hashInvitationToken,
  logTeamAuditEvent,
} from '../../src/lib/auth/team';
import {
  InviteStaffSchema,
  AcceptInvitationSchema,
  RevokeStaffAccessSchema,
  CancelInvitationSchema,
} from '../../src/lib/validations/team';
import {
  renderInvitationEmailHtml,
  renderInvitationEmailText,
  escapeHtml,
  sanitizeUrl,
} from '../../src/lib/email/invitation';
import * as supabaseServerModule from '../../src/lib/supabase/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('TASK-TEAM-001: Team Management Backend Unit Tests (FEAT-TEAM-001)', () => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();

  const mockSupabase = {
    auth: {
      getUser: mockGetUser,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
    from: mockFrom,
  };

  const orgId = '11111111-1111-4000-a000-000000000001';
  const roleMemberId = '22222222-2222-4000-a000-000000000001';
  const roleAdminId = '22222222-2222-4000-a000-000000000002';
  const branchHqId = '33333333-3333-4000-a000-000000000001';

  const ownerUser = { id: 'user-owner-uuid', email: 'owner@acme.com' };
  const adminUser = { id: 'user-admin-uuid', email: 'admin@acme.com' };
  const staffUser = { id: 'user-staff-uuid', email: 'staff@acme.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(supabaseServerModule, 'createClient').mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof supabaseServerModule.createClient> extends Promise<infer U> ? U : never
    );
  });

  // =========================================================================
  // 1. Staff Invitations
  // =========================================================================
  describe('inviteStaffAction', () => {
    it('allows Primary Owner to invite a staff member and generates hashed token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      let capturedInsertData: Record<string, unknown> | null = null;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => {
                const chain: Record<string, unknown> = {};
                chain.eq = vi.fn().mockReturnValue(chain);
                chain.maybeSingle = vi.fn().mockResolvedValue({
                  data: { id: 'mem-owner', is_owner: true, status: 'active' },
                  error: null,
                });
                return chain;
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member', is_system: false },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: branchHqId, name: 'Headquarters' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
              capturedInsertData = data;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'invite-123' },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'acme' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'newhire@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.invitationId).toBe('invite-123');
        expect(result.email).toBe('newhire@acme.com');
        expect(result.inviteUrl).toContain('http://mybusiness.localhost:3000/invite/accept?token=');

        // Verify that raw token is NOT stored in database, only token_hash
        expect(capturedInsertData).not.toBeNull();
        expect(capturedInsertData!.token_hash).toBeDefined();
        expect(capturedInsertData!.token).toBeUndefined();
        expect(capturedInsertData!.token_hash).toHaveLength(64); // SHA-256 hex string
      }
    });

    it('allows Administrator with manage_team role to invite a staff member', async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-admin', is_owner: false, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ role_id: roleAdminId, roles: { id: roleAdminId, name: 'Administrator', is_system: true } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member', is_system: false },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: branchHqId, name: 'Headquarters' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'invite-admin-issued' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'acme' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'developer@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.invitationId).toBe('invite-admin-issued');
      }
    });

    it('rejects unauthenticated caller', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'intruder@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('rejects non-manager member from sending invitations', async () => {
      mockGetUser.mockResolvedValue({ data: { user: staffUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-staff', is_owner: false, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ role_id: roleMemberId, roles: { id: roleMemberId, name: 'Member', is_system: false } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'role_permissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'another@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized: Only the Primary Owner or an Administrator');
    });

    it('rejects invalid role ID not belonging to organization', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-owner', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
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

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'valid@acme.com',
        roleId: '00000000-0000-0000-0000-000000000000',
        branchId: branchHqId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('The selected role does not exist');
    });

    it('rejects invitation when user is already an active member', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() => {
                    return Promise.resolve({
                      data: { id: 'mem-owner', is_owner: true, status: 'active' },
                      error: null,
                    });
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member', is_system: false },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: branchHqId, name: 'Headquarters' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-existing' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'existing@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already an active team member');
    });

    it('revokes previous pending invitation if email is re-invited', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-owner', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member', is_system: false },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: branchHqId, name: 'Headquarters' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [{ id: 'old-invite-uuid', expires_at: new Date(Date.now() + 86400000).toISOString() }],
                    error: null,
                  }),
                }),
              }),
            }),
            update: mockUpdate,
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-invite-uuid' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'acme' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'reinvite@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'revoked' });
    });
  });

  // =========================================================================
  // 2. Invitation Verification & Details
  // =========================================================================
  describe('getInvitationDetailsAction', () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const tokenHash = hashInvitationToken(rawToken);

    it('returns invitation details for a valid pending token', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                expect(val).toBe(tokenHash);
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inv-uuid',
                      organization_id: orgId,
                      email: 'invitee@acme.com',
                      status: 'pending',
                      expires_at: new Date(Date.now() + 86400000).toISOString(),
                      organizations: { name: 'Acme Corp', slug: 'acme' },
                      roles: { name: 'Member' },
                      branches: { name: 'Headquarters' },
                    },
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return {};
      });

      const result = await getInvitationDetailsAction(rawToken);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.invitation!.email).toBe('invitee@acme.com');
        expect(result.invitation!.organizationName).toBe('Acme Corp');
        expect(result.invitation!.roleName).toBe('Member');
      }
    });

    it('rejects expired invitation token', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-uuid',
                    status: 'pending',
                    expires_at: new Date(Date.now() - 10000).toISOString(), // Expired 10s ago
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await getInvitationDetailsAction(rawToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain('This invitation has expired');
    });

    it('rejects already accepted invitation token (replay defense)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-uuid',
                    status: 'accepted',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await getInvitationDetailsAction(rawToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already been accepted');
    });
  });

  // =========================================================================
  // 3. Invitation Acceptance
  // =========================================================================
  describe('acceptInvitationAction', () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('allows authenticated user with matching email to accept invitation and binds member, role, branch', async () => {
      const invitee = {
        id: 'invitee-user-uuid',
        email: 'invitee@acme.com',
        email_confirmed_at: '2026-10-10T00:00:00Z',
      };
      mockGetUser.mockResolvedValue({ data: { user: invitee }, error: null });

      let capturedMemberInsert: Record<string, unknown> | null = null;
      let capturedRoleInsert: Record<string, unknown> | null = null;
      let capturedBranchInsert: Record<string, unknown> | null = null;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    organization_id: orgId,
                    email: 'invitee@acme.com',
                    role_id: roleMemberId,
                    branch_id: branchHqId,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                    organizations: { slug: 'acme' },
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation(() => {
              const chain: Record<string, unknown> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.select = vi.fn().mockReturnValue(chain);
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'inv-1' }, error: null });
              return chain;
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
            insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
              capturedMemberInsert = data;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'mem-new-invitee' },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
              capturedRoleInsert = data;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'membership_branches') {
          return {
            insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
              capturedBranchInsert = data;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await acceptInvitationAction({ token: rawToken });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.organizationSlug).toBe('acme');
      }

      // Verify that member is created strictly as non-owner (sole ownership guard)
      expect(capturedMemberInsert).not.toBeNull();
      expect(capturedMemberInsert!.is_owner).toBe(false);
      expect(capturedMemberInsert!.status).toBe('active');
      expect(capturedMemberInsert!.organization_id).toBe(orgId);

      // Verify role and branch binding
      expect(capturedRoleInsert!.role_id).toBe(roleMemberId);
      expect(capturedBranchInsert!.branch_id).toBe(branchHqId);
    });

    it('rejects acceptance when authenticated caller email does not match invitation email', async () => {
      const wrongUser = { id: 'wrong-user-uuid', email: 'other@different.com' };
      mockGetUser.mockResolvedValue({ data: { user: wrongUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    organization_id: orgId,
                    email: 'intended-recipient@acme.com',
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await acceptInvitationAction({ token: rawToken });

      expect(result.success).toBe(false);
      expect(result.error).toContain('This invitation was issued to intended-recipient@acme.com');
    });

    it('rejects acceptance when authenticated caller email is not confirmed', async () => {
      const unconfirmedUser = {
        id: 'unconfirmed-uuid',
        email: 'invitee@acme.com',
        email_confirmed_at: null,
        confirmed_at: null,
      };
      mockGetUser.mockResolvedValue({ data: { user: unconfirmedUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    organization_id: orgId,
                    email: 'invitee@acme.com',
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await acceptInvitationAction({ token: rawToken });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Your email address is not verified');
    });

    it('halts acceptance and requests email verification when unauthenticated signup requires confirmation', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'new-unconfirmed-uuid', email: 'newstaff@acme.com', email_confirmed_at: null },
          session: null,
        },
        error: null,
      });

      let memberInsertCalled = false;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-new',
                    organization_id: orgId,
                    email: 'newstaff@acme.com',
                    role_id: roleMemberId,
                    branch_id: branchHqId,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organization_members') {
          memberInsertCalled = true;
          return {};
        }
        return {};
      });

      const result = await acceptInvitationAction({
        token: rawToken,
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
      expect(result.emailConfirmationRequired).toBe(true);
      expect(result.error).toContain('verify your email address before activating your company membership');
      expect(memberInsertCalled).toBe(false);
    });

    it('prevents concurrent double acceptance when invitation claim fails (CAS claim collision)', async () => {
      const verifiedUser = {
        id: 'verified-user-uuid',
        email: 'invitee@acme.com',
        email_confirmed_at: '2026-10-10T00:00:00Z',
      };
      mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    organization_id: orgId,
                    email: 'invitee@acme.com',
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation(() => {
              const chain: Record<string, unknown> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.select = vi.fn().mockReturnValue(chain);
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
              return chain;
            }),
          };
        }
        return {};
      });

      const result = await acceptInvitationAction({ token: rawToken });

      expect(result.success).toBe(false);
      expect(result.error).toContain('This invitation has already been accepted or is no longer available');
    });

    it('triggers compensating rollback if role binding fails after invitation claim', async () => {
      const verifiedUser = {
        id: 'verified-user-uuid',
        email: 'invitee@acme.com',
        email_confirmed_at: '2026-10-10T00:00:00Z',
      };
      mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });

      let revertedStatus: string | null = null;
      let memberDeleted = false;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inv-1',
                    organization_id: orgId,
                    email: 'invitee@acme.com',
                    role_id: roleMemberId,
                    branch_id: branchHqId,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              if (payload.status === 'pending') {
                revertedStatus = 'pending';
              }
              const chain: Record<string, unknown> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.select = vi.fn().mockReturnValue(chain);
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'inv-1' }, error: null });
              return chain;
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
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'mem-to-rollback' }, error: null }),
              }),
            }),
            delete: vi.fn().mockImplementation(() => {
              memberDeleted = true;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            insert: vi.fn().mockResolvedValue({ error: { message: 'Database constraint violation' } }),
          };
        }
        return {};
      });

      const result = await acceptInvitationAction({ token: rawToken });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to provision organization membership');
      expect(revertedStatus).toBe('pending');
      expect(memberDeleted).toBe(true);
    });
  });

  // =========================================================================
  // 4. Access Revocation & Suspension
  // =========================================================================
  describe('revokeStaffAccessAction', () => {
    it('allows Primary Owner to suspend an active staff member', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                  return {
                    maybeSingle: vi.fn().mockImplementation(() => {
                      if (val === ownerUser.id) {
                        return Promise.resolve({
                          data: { id: 'mem-owner', is_owner: true, status: 'active' },
                          error: null,
                        });
                      }
                      return Promise.resolve({
                        data: { id: 'mem-target', is_owner: false, status: 'active', user_id: 'user-target' },
                        error: null,
                      });
                    }),
                  };
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: '33333333-4444-4000-a000-000000000001',
        action: 'suspend',
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'suspended' });
    });

    it('strictly blocks suspending or removing the Primary Owner (DEC-010 Sole Ownership Guard)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                  return {
                    maybeSingle: vi.fn().mockImplementation(() => {
                      if (val === adminUser.id) {
                        return Promise.resolve({
                          data: { id: 'mem-admin', is_owner: false, status: 'active' },
                          error: null,
                        });
                      }
                      // Target is the Primary Owner!
                      return Promise.resolve({
                        data: { id: 'mem-owner', is_owner: true, status: 'active', user_id: 'owner-id' },
                        error: null,
                      });
                    }),
                  };
                }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ role_id: roleAdminId, roles: { id: roleAdminId, name: 'Administrator', is_system: true } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: '11111111-2222-4000-a000-000000000001',
        action: 'remove',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Primary Owner access cannot be revoked, suspended, or modified');
    });

    it('blocks user from revoking their own account access', async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-admin', is_owner: false, status: 'active', user_id: adminUser.id },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ role_id: roleAdminId, roles: { id: roleAdminId, name: 'Administrator', is_system: true } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: '22222222-3333-4000-a000-000000000001',
        action: 'suspend',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot revoke or suspend your own account access');
    });
  });

  // =========================================================================
  // 5. Team Roster Query
  // =========================================================================
  describe('getTeamRoster', () => {
    it('returns team members, pending invitations, and available roles', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockImplementation((fields: string) => {
              if (fields.includes('profiles')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'mem-1',
                          user_id: ownerUser.id,
                          is_owner: true,
                          status: 'active',
                          created_at: '2026-10-10T00:00:00Z',
                          profiles: { email: 'owner@acme.com', full_name: 'Alice Owner' },
                          membership_roles: [{ roles: { id: roleAdminId, name: 'Administrator', is_system: true } }],
                          membership_branches: [{ branches: { id: branchHqId, name: 'Headquarters' } }],
                        },
                      ],
                      error: null,
                    }),
                  }),
                };
              }
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'mem-owner', is_owner: true, status: 'active' },
                        error: null,
                      }),
                    }),
                  }),
                };
              }),
            };
          }
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'inv-1',
                        email: 'pending@acme.com',
                        status: 'pending',
                        expires_at: '2026-10-21T00:00:00Z',
                        created_at: '2026-10-14T00:00:00Z',
                        roles: { name: 'Member' },
                        branches: { name: 'Headquarters' },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: roleMemberId, name: 'Member', is_system: false }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: branchHqId, name: 'Headquarters' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const roster = await getTeamRoster(orgId);

      expect(roster.success).toBe(true);
      expect(roster.canManageTeam).toBe(true);
      expect(roster.members).toHaveLength(1);
      expect(roster.members[0].email).toBe('owner@acme.com');
      expect(roster.members[0].isOwner).toBe(true);
      expect(roster.pendingInvitations).toHaveLength(1);
      expect(roster.pendingInvitations[0].email).toBe('pending@acme.com');
      expect(roster.availableRoles).toHaveLength(1);
      expect(roster.availableBranches).toHaveLength(1);
    });

    it('rejects regular member without team-management permissions from viewing roster', async () => {
      mockGetUser.mockResolvedValue({ data: { user: staffUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-staff', is_owner: false, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'membership_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ role_id: roleMemberId, roles: { id: roleMemberId, name: 'Member', is_system: false } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'role_permissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const roster = await getTeamRoster(orgId);

      expect(roster.success).toBe(false);
      expect(roster.canManageTeam).toBe(false);
      expect(roster.members).toHaveLength(0);
      expect(roster.pendingInvitations).toHaveLength(0);
      expect(roster.availableRoles).toHaveLength(0);
      expect(roster.availableBranches).toHaveLength(0);
      expect(roster.error).toContain('Unauthorized');
    });
  });

  // =========================================================================
  // 6. Cryptographic Token Generation & Hashing
  // =========================================================================
  describe('Cryptographic Token Security', () => {
    it('generates 32-byte hex raw token and 64-character SHA-256 hash', () => {
      const { rawToken, tokenHash } = generateInvitationToken();
      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(hashInvitationToken(rawToken)).toBe(tokenHash);
    });

    it('hashes tokens deterministically with whitespace trimming', () => {
      const token = 'abcdef1234567890abcdef1234567890';
      const hash1 = hashInvitationToken(token);
      const hash2 = hashInvitationToken(`  ${token}  `);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  // =========================================================================
  // 7. Input Validation Schemas
  // =========================================================================
  describe('Team Validation Schemas', () => {
    it('validates InviteStaffSchema correctly and rejects invalid inputs', () => {
      const invalidEmail = InviteStaffSchema.safeParse({
        organizationId: orgId,
        email: 'invalid-email',
        roleId: roleMemberId,
        branchId: branchHqId,
      });
      expect(invalidEmail.success).toBe(false);

      const invalidOrg = InviteStaffSchema.safeParse({
        organizationId: 'not-a-uuid',
        email: 'valid@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });
      expect(invalidOrg.success).toBe(false);

      const valid = InviteStaffSchema.safeParse({
        organizationId: orgId,
        email: 'valid@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });
      expect(valid.success).toBe(true);
    });

    it('validates AcceptInvitationSchema token constraints', () => {
      const tooShort = AcceptInvitationSchema.safeParse({ token: 'short' });
      expect(tooShort.success).toBe(false);

      const valid = AcceptInvitationSchema.safeParse({
        token: 'abcdef1234567890abcdef1234567890abcdef1234567890',
      });
      expect(valid.success).toBe(true);
    });

    it('validates RevokeStaffAccessSchema action whitelist', () => {
      const invalidAction = RevokeStaffAccessSchema.safeParse({
        organizationId: orgId,
        membershipId: '11111111-1111-4000-a000-000000000001',
        action: 'delete' as unknown as 'suspend',
      });
      expect(invalidAction.success).toBe(false);

      const validSuspend = RevokeStaffAccessSchema.safeParse({
        organizationId: orgId,
        membershipId: '11111111-1111-4000-a000-000000000001',
        action: 'suspend',
      });
      expect(validSuspend.success).toBe(true);
    });

    it('validates CancelInvitationSchema UUID requirements', () => {
      const invalid = CancelInvitationSchema.safeParse({
        organizationId: orgId,
        invitationId: 'not-uuid',
      });
      expect(invalid.success).toBe(false);

      const valid = CancelInvitationSchema.safeParse({
        organizationId: orgId,
        invitationId: '11111111-1111-4000-a000-000000000001',
      });
      expect(valid.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. Branch Validation in Staff Invitations
  // =========================================================================
  describe('inviteStaffAction - Branch Validation', () => {
    it('rejects invitation when branch does not belong to organization', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-owner', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'staff@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('The selected operating branch does not exist in this organization');
    });
  });

  // =========================================================================
  // 9. Cancel Invitation Action
  // =========================================================================
  describe('cancelInvitationAction', () => {
    const invId = '44444444-4444-4000-a000-000000000001';

    it('allows Primary Owner to cancel a pending invitation', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      let capturedUpdate: Record<string, unknown> | null = null;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-owner', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'invitations') {
          return {
            update: vi.fn().mockImplementation((payload) => {
              capturedUpdate = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await cancelInvitationAction({
        organizationId: orgId,
        invitationId: invId,
      });

      expect(result.success).toBe(true);
      expect(capturedUpdate).toEqual({ status: 'revoked' });
    });

    it('rejects cancellation when caller is unauthenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await cancelInvitationAction({
        organizationId: orgId,
        invitationId: invId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });
  });

  // =========================================================================
  // 10. Access Management - Reinstate, Remove, and Cross-Org Guard
  // =========================================================================
  describe('revokeStaffAccessAction - Advanced Lifecycle', () => {
    const targetMemId = '55555555-5555-4000-a000-000000000001';

    it('allows Primary Owner to reinstate a suspended employee', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      let statusUpdatedTo: string | null = null;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string) => {
                  if (col === 'user_id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'mem-owner', is_owner: true, status: 'active' },
                        error: null,
                      }),
                    };
                  }
                  if (col === 'id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: targetMemId,
                          user_id: staffUser.id,
                          is_owner: false,
                          status: 'suspended',
                        },
                        error: null,
                      }),
                    };
                  }
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload) => {
              statusUpdatedTo = payload.status;
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: targetMemId,
        action: 'reinstate',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('reinstate');
      expect(statusUpdatedTo).toBe('active');
    });

    it('allows Primary Owner to remove an employee from organization', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      let deleted = false;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string) => {
                  if (col === 'user_id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'mem-owner', is_owner: true, status: 'active' },
                        error: null,
                      }),
                    };
                  }
                  if (col === 'id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: targetMemId,
                          user_id: staffUser.id,
                          is_owner: false,
                          status: 'active',
                        },
                        error: null,
                      }),
                    };
                  }
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
                }),
              }),
            }),
            delete: vi.fn().mockImplementation(() => {
              deleted = true;
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: targetMemId,
        action: 'remove',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('remove');
      expect(deleted).toBe(true);
    });

    it('fails closed when target member does not belong to requested organization (cross-org guard)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string) => {
                  if (col === 'user_id') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'mem-owner', is_owner: true, status: 'active' },
                        error: null,
                      }),
                    };
                  }
                  if (col === 'id') {
                    // Not found in this organization
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                  }
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await revokeStaffAccessAction({
        organizationId: orgId,
        membershipId: targetMemId,
        action: 'suspend',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target member does not exist in this organization');
    });
  });

  // =========================================================================
  // 11. Audit Logging Security & Token Sanitization
  // =========================================================================
  describe('Audit Logging Sanitization', () => {
    it('ensures logTeamAuditEvent writes structured event without sensitive credentials', async () => {
      let insertedLog: Record<string, unknown> | null = null;
      const client = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'audit_logs') {
            return {
              insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
                insertedLog = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      await logTeamAuditEvent(client as unknown as Parameters<typeof logTeamAuditEvent>[0], {
        organizationId: orgId,
        actorId: ownerUser.id,
        action: 'team.invite_created',
        resourceType: 'invitation',
        resourceId: 'inv-123',
        metadata: {
          email: 'newuser@acme.com',
          roleName: 'Member',
          tokenHashPrefix: 'abcdef12...',
        },
      });

      expect(insertedLog).toBeTruthy();
      const log = insertedLog as Record<string, unknown> | null;
      expect(log?.organization_id).toBe(orgId);
      expect(log?.actor_id).toBe(ownerUser.id);
      expect(log?.action).toBe('team.invite_created');
      expect(log?.resource).toBe('invitation:inv-123');
      const payload = log?.payload as Record<string, unknown> | undefined;
      expect(payload?.email).toBe('newuser@acme.com');
      // Ensure no raw token or password exists in payload
      expect(payload?.rawToken).toBeUndefined();
      expect(payload?.password).toBeUndefined();
    });
  });

  // =========================================================================
  // 12. Email Escaping, XSS Prevention & Delivery State (Findings 3 & 4)
  // =========================================================================
  describe('Email Escaping and Delivery State Reporting', () => {
    it('escapes dangerous HTML characters in user-supplied values', () => {
      expect(escapeHtml('<script>alert("XSS") & \'foo\'</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;) &amp; &#39;foo&#39;&lt;/script&gt;'
      );

      const maliciousOrg = 'Acme <script>alert("XSS")</script> & Co';
      const maliciousInviter = 'Jane "The Hacker" O\'Connor';
      const maliciousRole = '<b>SuperAdmin</b>';
      const maliciousBranch = 'HQ & "Branch" <1>';

      const html = renderInvitationEmailHtml({
        to: 'staff@example.com',
        organizationName: maliciousOrg,
        inviterName: maliciousInviter,
        roleName: maliciousRole,
        branchName: maliciousBranch,
        actionUrl: 'http://mybusiness.localhost:3000/invite/accept?token=validtoken123456789012345678901234567890',
      });

      // Assert malicious tags are neutralized
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</script>');
      expect(html).not.toContain('<b>SuperAdmin</b>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).toContain('Jane &quot;The Hacker&quot; O&#39;Connor');
      expect(html).toContain('&lt;b&gt;SuperAdmin&lt;/b&gt;');
      expect(html).toContain('HQ &amp; &quot;Branch&quot; &lt;1&gt;');

      const text = renderInvitationEmailText({
        to: 'staff@example.com',
        organizationName: maliciousOrg,
        inviterName: maliciousInviter,
        roleName: maliciousRole,
        branchName: maliciousBranch,
        actionUrl: 'http://mybusiness.localhost:3000/invite/accept?token=validtoken123456789012345678901234567890',
      });
      expect(text).toContain(maliciousOrg);
      expect(text).toContain('7 days');
    });

    it('sanitizes unsafe URL protocols to prevent javascript: execution', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeUrl('data:text/html,malicious')).toBe('#');
      expect(sanitizeUrl('https://mybusiness.stack37.com/invite/accept?token=xyz')).toBe(
        'https://mybusiness.stack37.com/invite/accept?token=xyz'
      );
    });

    it('reports explicit email delivery status on invite creation', async () => {
      mockGetUser.mockResolvedValue({ data: { user: ownerUser }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mem-owner', is_owner: true, status: 'active' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: roleMemberId, name: 'Member', is_system: false },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'branches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: branchHqId, name: 'Headquarters' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'invite-delivery-check' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Acme Corp', slug: 'acme' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await inviteStaffAction({
        organizationId: orgId,
        email: 'deliverytest@acme.com',
        roleId: roleMemberId,
        branchId: branchHqId,
      });

      expect(result.success).toBe(true);
      expect(result.invitationId).toBe('invite-delivery-check');
      expect(result.inviteUrl).toBeDefined();
      // In unit test environment (MAILPIT_URL omitted), emailDelivered is false and error is reported
      expect(result.emailDelivered).toBe(false);
      expect(result.emailDeliveryError).toBeDefined();
    });
  });
});
