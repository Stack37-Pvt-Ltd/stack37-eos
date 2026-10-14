import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvitationAcceptance, TeamManagement, type TeamRoster } from '../../src/components/tenant/team-management';

const roster: TeamRoster = {
  canManageTeam: true,
  members: [
    { membershipId: 'owner-1', userId: 'user-1', email: 'owner@example.test', fullName: 'Primary Owner', isOwner: true, status: 'active', roles: [{ id: 'admin', name: 'Administrator', isSystem: true }], branches: [{ id: 'hq', name: 'Headquarters' }], joinedAt: '2026-01-01' },
    { membershipId: 'member-1', userId: 'user-2', email: 'member@example.test', fullName: 'Team Member', isOwner: false, status: 'suspended', roles: [{ id: 'member', name: 'Member', isSystem: false }], branches: [{ id: 'south', name: 'Southern Branch' }], joinedAt: '2026-02-01' },
  ],
  pendingInvitations: [{ id: 'invite-1', email: 'pending@example.test', roleName: 'Member', branchName: 'Southern Branch', expiresAt: '2026-12-20T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' }],
  availableRoles: [{ id: 'admin', name: 'Administrator', isSystem: true }, { id: 'member', name: 'Member', isSystem: false }],
  availableBranches: [{ id: 'hq', name: 'Headquarters' }, { id: 'south', name: 'Southern Branch' }],
};

describe('Team Management frontend presentation', () => {
  it('shows business access information, statuses, pending expiry, and protects the Primary Owner', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={roster} actions={{ invite: async () => ({ success: true }), updateMember: async () => ({ success: true }), cancelInvitation: async () => ({ success: true }) }} />);
    expect(html).toContain('Primary Owner');
    expect(html).toContain('member@example.test');
    expect(html).toContain('Southern Branch');
    expect(html).toContain('suspended');
    expect(html).toContain('Expires Dec 20, 2026');
    expect(html).toContain('Protected');
    expect(html).not.toContain('aria-label="Suspend or reinstate Primary Owner"');
  });

  it('keeps invitations and access changes disabled until roster actions are connected', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={null} />);
    expect(html).toContain('Team connection pending');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('Invite a teammate');
  });

  it('shows an unavailable state when the invitation lookup contract is not connected', () => {
    const html = renderToStaticMarkup(<InvitationAcceptance invitation={{ status: 'unavailable' }} />);
    expect(html).toContain('Invitation unavailable');
    expect(html).toContain('Go to sign in');
  });

  it('preserves an invitation token through the existing account sign-in route', () => {
    const html = renderToStaticMarkup(<InvitationAcceptance invitation={{ status: 'valid', email: 'pending@example.test', organizationName: 'Example Business', roleName: 'Member', branchName: null, expiresAt: '2026-12-20T00:00:00.000Z' }} token="opaque-token" initialAccountMode="existing" />);
    expect(html).toContain('next=%2Finvite%2Faccept%3Ftoken%3Dopaque-token');
    expect(html).toContain('forgot-password');
  });
});
