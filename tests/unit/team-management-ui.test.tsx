import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvitationAcceptance, TeamManagement, type TeamRoster } from '../../src/components/tenant/team-management';
import TeamSettingsLoading from '../../src/app/tenant/[tenantSlug]/settings/team/loading';

const roster: TeamRoster = {
  canManageTeam: true,
  members: [
    { membershipId: 'owner-1', userId: 'user-1', email: 'owner@example.test', fullName: 'Primary Owner', isOwner: true, status: 'active', roles: [{ id: 'admin', name: 'Administrator', isSystem: true }], branches: [{ id: 'hq', name: 'Headquarters' }], joinedAt: '2026-01-01' },
    { membershipId: 'member-1', userId: 'user-2', email: 'member@example.test', fullName: 'Team Member', isOwner: false, status: 'suspended', roles: [{ id: 'member', name: 'Member', isSystem: false }], branches: [{ id: 'south', name: 'Southern Branch' }], joinedAt: '2026-02-01' },
  ],
  pendingInvitations: [
    { id: 'invite-1', email: 'pending@example.test', roleName: 'Member', branchName: 'Southern Branch', expiresAt: '2026-12-20T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'invite-2', email: 'expired@example.test', roleName: 'Member', branchName: 'Southern Branch', expiresAt: '2026-10-10T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' },
  ],
  availableRoles: [{ id: 'admin', name: 'Administrator', isSystem: true }, { id: 'member', name: 'Member', isSystem: false }],
  availableBranches: [{ id: 'hq', name: 'Headquarters' }, { id: 'south', name: 'Southern Branch' }],
};

describe('Team Management frontend presentation', () => {
  it('provides an accessible loading state for the Team route', () => {
    const html = renderToStaticMarkup(<TeamSettingsLoading />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading Team Management"');
    expect(html).toContain('Loading workspace members and invitations.');
  });

  it('shows business access information, statuses, pending expiry, and protects the Primary Owner', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={roster} actions={{ invite: async () => ({ success: true }), updateMember: async () => ({ success: true }), cancelInvitation: async () => ({ success: true }) }} />);
    expect(html).toContain('Primary Owner');
    expect(html).toContain('member@example.test');
    expect(html).toContain('Southern Branch');
    expect(html).toContain('suspended');
    expect(html).toContain('Expires Dec 20, 2026');
    expect(html).toContain('1 pending');
    expect(html).toContain('1 expired');
    expect(html).toContain('Protected');
    expect(html).not.toContain('aria-label="Suspend or reinstate Primary Owner"');
  });

  it('keeps invitations and access changes disabled until roster actions are connected', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={null} />);
    expect(html).toContain('Team connection pending');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('Invite a teammate');
  });

  it('shows a useful loading failure without reporting the roster as empty', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={null} rosterError="The team service could not load this workspace." />);
    expect(html).toContain('Team data unavailable');
    expect(html).toContain('The team service could not load this workspace.');
    expect(html).toContain('Team roster unavailable');
    expect(html).not.toContain('0 people with workspace access');
    expect(html).toContain('Invitation list unavailable');
  });

  it('shows a successful empty roster separately from a failed roster', () => {
    const emptyRoster: TeamRoster = { ...roster, members: [], pendingInvitations: [] };
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={emptyRoster} actions={{ invite: async () => ({ success: true }), updateMember: async () => ({ success: true }), cancelInvitation: async () => ({ success: true }) }} />);
    expect(html).toContain('0 people with workspace access');
    expect(html).toContain('No employees yet');
    expect(html).toContain('0 pending');
    expect(html).toContain('0 expired');
    expect(html).not.toContain('Team data unavailable');
  });

  it('disables all Team mutations and explains the read-only preview state accessibly', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={roster} previewReadOnly actions={{ invite: async () => ({ success: true }), updateMember: async () => ({ success: true }), cancelInvitation: async () => ({ success: true }) }} />);
    expect(html).toContain('Read-only preview');
    expect(html).toContain('Invitations, role and branch assignments, cancellation, suspension, reinstatement, and removal are unavailable.');
    expect(html).toContain('Team changes are disabled in this Vercel Preview to protect shared live records.');
    expect(html).toContain('aria-label="Suspend or reinstate Team Member"');
    expect(html).toContain('aria-label="Remove Team Member"');
    expect(html).toMatch(/>Invite employee<\/button>/);
    expect(html).toContain('1 pending');
    expect(html).toContain('1 expired');
    expect(html.match(/disabled=""/g)?.length).toBe(5);
    expect(html.match(/aria-describedby="[^"]+"/g)?.length).toBe(5);
  });

  it('keeps successful non-manager rosters view-only', () => {
    const html = renderToStaticMarkup(<TeamManagement organizationName="Example Business" roster={{ ...roster, canManageTeam: false }} actions={{ invite: async () => ({ success: true }), updateMember: async () => ({ success: true }), cancelInvitation: async () => ({ success: true }) }} />);
    expect(html).toContain('Your current access does not allow team changes.');
    expect(html).toContain('aria-describedby=');
    expect(html.match(/disabled=""/g)?.length).toBe(5);
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
