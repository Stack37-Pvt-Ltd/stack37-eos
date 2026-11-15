'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BadgeCheck, Building2, CalendarClock, Check, ChevronDown, CircleAlert, Copy, MailPlus, MoreHorizontal, Search, Shield, UserRound, Users } from 'lucide-react';

export type TeamRole = { id: string; name: string; isSystem: boolean };
export type TeamBranch = { id: string; name: string };
export type TeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  isOwner: boolean;
  status: 'active' | 'suspended';
  roles: TeamRole[];
  branches: TeamBranch[];
  joinedAt: string;
};
export type TeamInvitation = {
  id: string;
  email: string;
  roleName: string;
  branchName: string | null;
  expiresAt: string;
  createdAt: string;
};
export type TeamRoster = {
  canManageTeam: boolean;
  members: TeamMember[];
  pendingInvitations: TeamInvitation[];
  availableRoles: TeamRole[];
  availableBranches: TeamBranch[];
};
export type TeamActions = {
  invite?(input: { email: string; roleId: string; branchId: string }): Promise<{ success: boolean; error?: string; invitationId?: string; email?: string; inviteUrl?: string; emailDelivered?: boolean; emailDeliveryError?: string }>;
  updateMember(input: { membershipId: string; action: 'suspend' | 'reinstate' | 'remove' }): Promise<{ success: boolean; error?: string }>;
  cancelInvitation(input: { invitationId: string }): Promise<{ success: boolean; error?: string }>;
  updateAssignment?(input: { membershipId: string; roleId: string; branchId: string }): Promise<{ success: boolean; error?: string }>;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function Status({ status }: { status: 'active' | 'suspended' | 'pending' | 'expired' }) {
  const styles = {
    active: 'border-blue-200 bg-blue-50 text-blue-800',
    suspended: 'border-slate-300 bg-slate-100 text-slate-700',
    pending: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    expired: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium capitalize ${styles[status]}`}><span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />{status}</span>;
}

export function TeamManagement({ organizationName, roster, rosterError, actions, previewReadOnly = false, reviewMode = false }: {
  organizationName: string;
  roster: TeamRoster | null;
  rosterError?: string;
  actions?: TeamActions;
  previewReadOnly?: boolean;
  reviewMode?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [actionTarget, setActionTarget] = React.useState<TeamMember | TeamInvitation | null>(null);
  const [assignmentTarget, setAssignmentTarget] = React.useState<TeamMember | null>(null);
  const [actionKind, setActionKind] = React.useState<'suspend' | 'reinstate' | 'remove' | 'cancel'>('suspend');
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const [notice, setNotice] = React.useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const mutationHelpId = React.useId();
  const canManage = Boolean(!previewReadOnly && roster?.canManageTeam && actions);
  const canInvite = Boolean(canManage && actions?.invite);
  const mutationUnavailableReason = previewReadOnly
    ? 'Team changes are disabled in this Vercel Preview to protect shared live records.'
    : roster?.canManageTeam
      ? 'This operation is unavailable in the current environment.'
      : 'Your current workspace access does not allow team changes.';
  const members = roster?.members ?? [];
  const invites = roster?.pendingInvitations ?? [];
  const filtered = members.filter((member) => {
    const searchable = `${member.fullName ?? ''} ${member.email} ${member.roles.map((role) => role.name).join(' ')} ${member.branches.map((branch) => branch.name).join(' ')}`.toLowerCase();
    return searchable.includes(query.toLowerCase()) && (statusFilter === 'all' || member.status === statusFilter);
  });
  const expiredInvites = invites.filter((invite) => new Date(invite.expiresAt).valueOf() <= Date.now());
  const currentInvites = invites.filter((invite) => new Date(invite.expiresAt).valueOf() > Date.now());

  function requestAction(member: TeamMember, action: 'suspend' | 'reinstate' | 'remove') {
    if (member.isOwner || !canManage) return;
    setActionTarget(member); setActionKind(action); setNotice(null); setActionError('');
  }
  function requestCancel(invitation: TeamInvitation) {
    if (!canManage) return;
    setActionTarget(invitation); setActionKind('cancel'); setNotice(null); setActionError('');
  }
  async function confirmAction() {
    if (!actionTarget || !actions || !canManage || busy) return;
    setBusy(true); setNotice(null); setActionError('');
    try {
      const result = 'membershipId' in actionTarget
        ? await actions.updateMember({ membershipId: actionTarget.membershipId, action: actionKind as 'suspend' | 'reinstate' | 'remove' })
        : await actions.cancelInvitation({ invitationId: actionTarget.id });
      if (result.success) {
        setNotice({ kind: 'success', message: actionKind === 'cancel' ? 'Invitation cancelled.' : actionKind === 'remove' ? 'Employee access removed.' : actionKind === 'suspend' ? 'Employee access suspended.' : 'Employee access reinstated.' });
        setActionTarget(null);
      } else setActionError(result.error || 'The change could not be completed.');
    } catch {
      setActionError('The change could not be completed. Try again.');
    } finally { setBusy(false); }
  }

  return <div className="min-w-0 space-y-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow mb-3">People & access</p><h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Team</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Manage who can access {organizationName}.</p></div>
      <Button onClick={() => { if (!canInvite) return; setInviteOpen(true); setNotice(null); setInviteUrl(null); }} disabled={!canInvite} aria-describedby={!canInvite ? mutationHelpId : undefined}><MailPlus aria-hidden="true" className="h-4 w-4" />Invite employee</Button>
    </div>

    {notice && <Alert variant={notice.kind} title={notice.kind === 'success' ? 'Updated' : 'Action needs attention'}>{notice.message}{inviteUrl && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="One-time invitation link" readOnly value={inviteUrl} className="min-h-10 min-w-0 flex-1 border border-slate-300 bg-white px-3 text-xs text-slate-700" /><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); setNotice({ kind: 'success', message: 'Invitation link copied. Share it only with the invited employee.' }); } catch { setNotice({ kind: 'error', message: 'Could not copy the invitation link. Select and copy it manually.' }); } }}><Copy aria-hidden="true" className="h-4 w-4" />Copy link</Button></div>}</Alert>}
    {previewReadOnly && <Alert variant="info" title="Read-only preview">Team changes are disabled here to protect shared live records. Invitations, role and branch assignments, cancellation, suspension, reinstatement, and removal are unavailable.</Alert>}
    {!roster && (rosterError
      ? <Alert variant="error" title="Team data unavailable">{rosterError}</Alert>
      : <Alert variant="info" title="Team connection pending">This workspace is not connected to the Team Management service yet. No changes can be submitted.</Alert>)}
    {roster && !roster.canManageTeam && <Alert variant="info" title="View only">Your current access does not allow team changes.</Alert>}
    {(!canManage || !canInvite) && <p id={mutationHelpId} className="sr-only">{mutationUnavailableReason}</p>}

    <section aria-labelledby="team-members-heading" className="min-w-0 border border-brand-line bg-white">
      <div className="flex flex-col gap-4 border-b border-brand-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 id="team-members-heading" className="text-base font-semibold text-brand-navy">Employees</h2><p className="mt-1 text-sm text-slate-500">{roster ? `${members.length} ${members.length === 1 ? 'person' : 'people'} with workspace access` : 'Team roster unavailable'}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative"><span className="sr-only">Search employees</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team" className="min-h-10 w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-blue sm:w-56" /></label>
          <label className="relative"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 w-full appearance-none border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-brand-blue sm:w-36"><option value="all">All status</option><option value="active">Active</option><option value="suspended">Suspended</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>
        </div>
      </div>
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500"><th scope="col" className="px-6 py-3">Employee</th><th scope="col" className="px-4 py-3">Role</th><th scope="col" className="px-4 py-3">Branch</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Joined</th><th scope="col" aria-label="Actions" className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map((member) => <tr key={member.membershipId} className="text-slate-700 hover:bg-slate-50/70"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">{(member.fullName || member.email).slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="flex items-center gap-2 font-medium text-brand-navy">{member.fullName || 'Name not provided'}{member.isOwner && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"><Shield aria-hidden="true" className="h-3 w-3" />Primary Owner</span>}</span><span className="block truncate text-xs text-slate-500">{member.email}</span></span></div></td><td className="px-4 py-4">{member.roles.map((role) => role.name).join(', ') || '—'}</td><td className="px-4 py-4">{member.branches.map((branch) => branch.name).join(', ') || 'All branches'}</td><td className="px-4 py-4"><Status status={member.status} /></td><td className="px-4 py-4 whitespace-nowrap text-slate-500">{dateLabel(member.joinedAt)}</td><td className="px-4 py-4 text-right">{member.isOwner ? <span className="text-xs text-slate-400">Protected</span> : <div className="relative inline-flex gap-1"><Button variant="ghost" size="sm" disabled={!canManage} aria-describedby={!canManage ? mutationHelpId : undefined} aria-label={`Change role or branch for ${member.fullName || member.email}`} onClick={() => setAssignmentTarget(member)}>Assign</Button><Button variant="ghost" size="sm" disabled={!canManage} aria-describedby={!canManage ? mutationHelpId : undefined} aria-label={`Suspend or reinstate ${member.fullName || member.email}`} onClick={() => requestAction(member, member.status === 'active' ? 'suspend' : 'reinstate')}>{member.status === 'active' ? 'Suspend' : 'Reinstate'}</Button><Button variant="ghost" size="sm" disabled={!canManage} aria-describedby={!canManage ? mutationHelpId : undefined} aria-label={`Remove ${member.fullName || member.email}`} onClick={() => requestAction(member, 'remove')}><MoreHorizontal className="h-4 w-4" /></Button></div>}</td></tr>)}
            {roster && filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center"><Users aria-hidden="true" className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700">{query || statusFilter !== 'all' ? 'No matching employees' : 'No employees yet'}</p><p className="mt-1 text-xs text-slate-500">{query || statusFilter !== 'all' ? 'Try another search or status.' : canInvite ? 'Invite a teammate to give them access.' : 'No employees currently have access to this workspace.'}</p></td></tr>}
            {!roster && <tr><td colSpan={6} className="px-6 py-12 text-center"><Users aria-hidden="true" className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700">Employee list unavailable</p><p className="mt-1 text-xs text-slate-500">{rosterError || 'Connect the team service to load workspace members.'}</p></td></tr>}
          </tbody></table>
      </div>
    </section>

    <section aria-labelledby="pending-heading" className="min-w-0 border border-brand-line bg-white">
      <div className="flex flex-col gap-3 border-b border-brand-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 id="pending-heading" className="text-base font-semibold text-brand-navy">Invitations</h2><p className="mt-1 text-sm text-slate-500">People invited to join this workspace.</p></div>{roster ? <div className="flex flex-wrap gap-2" aria-label={`${currentInvites.length} pending invitations and ${expiredInvites.length} expired invitations`}><span className="border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-900">{currentInvites.length} pending</span><span className="border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">{expiredInvites.length} expired</span></div> : <span className="border border-slate-200 px-2 py-1 text-xs text-slate-600">Unavailable</span>}</div>
      <div className="divide-y divide-slate-100">{[...currentInvites, ...expiredInvites].map((invite) => { const expired = new Date(invite.expiresAt).valueOf() <= Date.now(); return <div key={invite.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-medium text-brand-navy">{invite.email}</p><p className="mt-1 text-xs text-slate-500">{invite.roleName} <span className="px-1 text-slate-300">·</span> {invite.branchName || 'All branches'}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="flex items-center gap-3"><Status status={expired ? 'expired' : 'pending'} /><span className="text-xs text-slate-500">{expired ? `Expired ${dateLabel(invite.expiresAt)}` : `Expires ${dateLabel(invite.expiresAt)}`}</span></div><Button variant="outline" size="sm" disabled={!canManage} aria-describedby={!canManage ? mutationHelpId : undefined} onClick={() => requestCancel(invite)}>Cancel</Button></div></div>; })}
        {invites.length === 0 && <div className="px-6 py-8 text-sm text-slate-500">{roster ? 'No pending invitations.' : 'Invitation list unavailable.'}</div>}
      </div>
    </section>

    {inviteOpen && canInvite && <InviteDialog roles={roster?.availableRoles ?? []} branches={roster?.availableBranches ?? []} busy={busy} onClose={() => setInviteOpen(false)} onSubmit={async (input) => { if (previewReadOnly || !canInvite || !actions?.invite || busy) return { success: false, error: mutationUnavailableReason }; setBusy(true); setNotice(null); setInviteUrl(null); try { const result = await actions.invite(input); if (result.success) { setNotice({ kind: 'success', message: result.emailDelivered ? `Invitation sent to ${input.email}.` : `Invitation created for ${input.email}, but the email could not be sent. Share the one-time link securely.` }); setInviteUrl(result.inviteUrl ?? null); setInviteOpen(false); } return result; } catch { return { success: false, error: 'The invitation could not be created. Try again.' }; } finally { setBusy(false); } }} />}
    {actionTarget && <ConfirmDialog targetName={'fullName' in actionTarget ? actionTarget.fullName || actionTarget.email : actionTarget.email} action={actionKind} busy={busy} error={actionError} onClose={() => setActionTarget(null)} onConfirm={confirmAction} />}
    {assignmentTarget && roster && <AssignmentDialog member={assignmentTarget} roles={roster.availableRoles} branches={roster.availableBranches} busy={busy} onClose={() => setAssignmentTarget(null)} onSave={async (input) => {
      if (previewReadOnly || !canManage || busy) return { success: false, error: mutationUnavailableReason };
      setBusy(true); setActionError('');
      try {
        const result = actions?.updateAssignment ? await actions.updateAssignment({ membershipId: assignmentTarget.membershipId, ...input }) : { success: false, error: 'Assignment updates are unavailable.' };
        if (result.success) { setAssignmentTarget(null); setNotice({ kind: 'success', message: `Role and branch updated for ${assignmentTarget.email}.` }); }
        else setActionError(result.error || 'The assignment could not be saved.');
        return result;
      } catch { setActionError('The assignment could not be saved. Try again.'); return { success: false, error: 'The assignment could not be saved. Try again.' }; }
      finally { setBusy(false); }
    }} />}
    {reviewMode && <p className="text-xs text-slate-400">Local visual review · mock data and actions</p>}
  </div>;
}

function InviteDialog({ roles, branches, busy, onClose, onSubmit }: { roles: TeamRole[]; branches: TeamBranch[]; busy: boolean; onClose: () => void; onSubmit: (input: { email: string; roleId: string; branchId: string }) => Promise<{ success: boolean; error?: string }> }) {
  const [error, setError] = React.useState('');
  const [email, setEmail] = React.useState(''); const [roleId, setRoleId] = React.useState(roles[0]?.id || ''); const [branchId, setBranchId] = React.useState(branches[0]?.id || '');
  return <Modal title="Invite employee" onClose={onClose}><p className="mb-5 text-sm text-slate-600">Choose a role and branch for their access.</p><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); if (busy) return; setError(''); if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid work email.'); return; } if (!roleId || !branchId) { setError('Choose an available role and branch.'); return; } const result = await onSubmit({ email: email.trim().toLowerCase(), roleId, branchId }); if (!result.success) setError(result.error || 'The invitation could not be sent.'); }}>
    <Input label="Work email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)} required className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-brand-blue">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">Operating branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)} required className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-brand-blue">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    {!roles.length || !branches.length ? <Alert variant="warning">Available roles and branches have not loaded.</Alert> : null}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="flex flex-col-reverse gap-2 border-t border-brand-line pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" isLoading={busy} disabled={!roles.length || !branches.length}><MailPlus className="h-4 w-4" />Send invitation</Button></div>
  </form></Modal>;
}

function AssignmentDialog({ member, roles, branches, busy, onClose, onSave }: {
  member: TeamMember; roles: TeamRole[]; branches: TeamBranch[]; busy: boolean; onClose: () => void;
  onSave: (input: { roleId: string; branchId: string }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [roleId, setRoleId] = React.useState(member.roles[0]?.id || '');
  const [branchId, setBranchId] = React.useState(member.branches[0]?.id || '');
  const [error, setError] = React.useState('');
  return <Modal title="Assign role and branch" onClose={onClose}>
    <p className="mb-5 break-all text-sm text-slate-600">Update access for <strong className="text-brand-navy">{member.fullName || member.email}</strong>.</p>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setError('');
      if (!roleId || !branchId) { setError('Choose a role and operating branch.'); return; }
      const result = await onSave({ roleId, branchId });
      if (!result.success) setError(result.error || 'The assignment could not be saved.');
    }}>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)} required className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-brand-blue">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">Operating branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)} required className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-brand-blue">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!roles.length || !branches.length ? <Alert variant="warning">Available roles and branches have not loaded.</Alert> : null}
      <div className="flex flex-col-reverse gap-2 border-t border-brand-line pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" isLoading={busy} disabled={!roles.length || !branches.length}>Save assignment</Button></div>
    </form>
  </Modal>;
}

function ConfirmDialog({ targetName, action, busy, error, onClose, onConfirm }: { targetName: string; action: 'suspend' | 'reinstate' | 'remove' | 'cancel'; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  const destructive = action === 'remove' || action === 'cancel';
  const description = action === 'cancel' ? 'They will no longer be able to use this invitation.' : action === 'remove' ? 'They will lose access to this workspace.' : action === 'suspend' ? 'They will be unable to access this workspace until reinstated.' : 'They will regain access to this workspace.';
  return <Modal title={action === 'cancel' ? 'Cancel invitation?' : action === 'remove' ? 'Remove employee?' : action === 'suspend' ? 'Suspend access?' : 'Reinstate access?'} onClose={onClose}><p className="text-sm text-slate-600">{description}</p><p className="mt-3 break-all text-sm font-medium text-brand-navy">{targetName}</p>{error && <Alert className="mt-4" variant="error">{error}</Alert>}<div className="mt-6 flex flex-col-reverse gap-2 border-t border-brand-line pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onClose}>Keep access</Button><Button className={destructive ? 'bg-rose-700 hover:bg-rose-800' : ''} isLoading={busy} onClick={onConfirm}>{action === 'cancel' ? 'Cancel invitation' : action === 'remove' ? 'Remove access' : action === 'suspend' ? 'Suspend access' : 'Reinstate access'}</Button></div></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') ?? []);
    (focusable().find((element) => element instanceof HTMLInputElement) ?? focusable()[0])?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="team-dialog-heading" className="my-auto w-full max-w-lg border border-slate-300 bg-white p-5 shadow-xl sm:p-7"><div className="mb-3 flex items-start justify-between gap-4"><h2 id="team-dialog-heading" className="text-xl font-semibold tracking-tight text-brand-navy">{title}</h2><Button variant="ghost" size="sm" aria-label="Close dialog" onClick={onClose}>×</Button></div>{children}</section></div>;
}

export type InvitationView =
  | { status: 'valid'; email: string; organizationName: string; roleName: string; branchName: string | null; expiresAt: string }
  | { status: 'expired' | 'revoked' | 'invalid' | 'used' }
  | { status: 'unavailable' };

export function InvitationAcceptance({ invitation, onAccept, token, authenticatedEmail, previewReadOnly = false, initialAccountMode = 'new', reviewMode = false }: { invitation: InvitationView; onAccept?: (input: { fullName: string; password: string }) => Promise<{ success: boolean; emailConfirmationRequired?: boolean; error?: string; organizationSlug?: string }>; token?: string; authenticatedEmail?: string | null; previewReadOnly?: boolean; initialAccountMode?: 'new' | 'existing'; reviewMode?: boolean }) {
  const [mode, setMode] = React.useState<'new' | 'existing'>(initialAccountMode);
  const [firstName, setFirstName] = React.useState(''); const [lastName, setLastName] = React.useState(''); const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [signedInNotice, setSignedInNotice] = React.useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const terminalCopy = {
    expired: ['Invitation expired', 'Ask the business administrator to send a new invitation.'],
    revoked: ['Invitation cancelled', 'This invitation is no longer available. Contact the person who invited you.'],
    invalid: ['Invitation not found', 'Check that you opened the complete invitation link.'],
    used: ['Invitation already used', 'This invitation has already been accepted. Sign in with your STACK37 account.'],
    unavailable: ['Invitation unavailable', 'We could not verify this invitation right now. Try again later or contact the business.'],
  } as const;
  if (invitation.status !== 'valid') return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-12"><section className="w-full border border-brand-line bg-white p-7 sm:p-10"><p className="eyebrow mb-4">STACK37 · Invitation</p><CircleAlert aria-hidden="true" className="mb-4 h-6 w-6 text-slate-500" /><h1 className="text-2xl font-semibold tracking-tight text-brand-navy">{terminalCopy[invitation.status][0]}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{terminalCopy[invitation.status][1]}</p><Button asChild variant="outline" className="mt-7"><Link href="/login">Go to sign in</Link></Button></section></main>;
  const invite = invitation;
  const returnPath = token ? `/invite/accept?token=${encodeURIComponent(token)}` : '/invite/accept';
  const signedInMatches = Boolean(authenticatedEmail && authenticatedEmail.toLowerCase() === invite.email.toLowerCase());
  const signedInMismatch = Boolean(authenticatedEmail && !signedInMatches);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null);
    if (mode === 'existing') { setMessage({ type: 'info', text: 'Sign in with the invited email address, then return to this link. Email verification is required before access is activated.' }); return; }
    if (!onAccept) { setMessage({ type: 'info', text: 'Invitation acceptance is paused until the security-verified backend integration is connected.' }); return; }
    setBusy(true);
    try { const result = await onAccept({ fullName: `${firstName.trim()} ${lastName.trim()}`.trim(), password }); setMessage(result.success ? { type: 'success', text: 'Invitation accepted.' } : result.emailConfirmationRequired ? { type: 'info', text: result.error || 'Verify your email before workspace access is activated.' } : { type: 'error', text: result.error || 'The invitation could not be accepted.' }); }
    catch { setMessage({ type: 'error', text: 'The invitation could not be accepted. Try again.' }); }
    finally { setBusy(false); }
  }
  async function acceptSignedIn() {
    if (!onAccept || !signedInMatches || previewReadOnly || busy) return;
    setBusy(true); setSignedInNotice(null);
    try {
      const result = await onAccept({ fullName: '', password: '' });
      if (!result.success) setSignedInNotice({ type: result.emailConfirmationRequired ? 'info' : 'error', text: result.error || 'The invitation could not be accepted.' });
    } catch {
      setSignedInNotice({ type: 'error', text: 'The invitation could not be accepted. Try again.' });
    } finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-12"><section className="w-full border border-brand-line bg-white p-6 sm:p-10"><p className="eyebrow mb-3">STACK37 · Team invitation</p><h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Join {invite.organizationName}</h1><p className="mt-3 text-sm text-slate-600">Invitation for <strong className="font-medium text-brand-navy">{invite.email}</strong></p><div className="mt-6 grid gap-3 border-y border-brand-line py-4 text-sm sm:grid-cols-2"><p className="flex items-center gap-2 text-slate-600"><BadgeCheck className="h-4 w-4 text-brand-blue" />{invite.roleName}</p><p className="flex items-center gap-2 text-slate-600"><Building2 className="h-4 w-4 text-brand-blue" />{invite.branchName || 'All branches'}</p><p className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-2"><CalendarClock className="h-4 w-4" />Expires {dateLabel(invite.expiresAt)}</p></div>
    {previewReadOnly && <Alert className="mt-5" variant="info" title="Read-only preview">Invitation acceptance is disabled here to protect shared live records.</Alert>}
    {signedInMismatch && <Alert className="mt-5" variant="warning" title="Use the invited account">You are signed in as {authenticatedEmail}. Sign out, then sign in as {invite.email} to accept this invitation.</Alert>}
    {signedInMatches ? <div className="mt-5 space-y-4"><p className="text-sm text-slate-600">Signed in as <strong className="text-brand-navy">{authenticatedEmail}</strong>. Accepting will add the assigned role and branch to this account.</p>{signedInNotice && <Alert variant={signedInNotice.type}>{signedInNotice.text}</Alert>}<Button className="w-full" onClick={acceptSignedIn} isLoading={busy} disabled={!onAccept || previewReadOnly}><Check aria-hidden="true" className="h-4 w-4" />Accept invitation</Button></div> : !signedInMismatch && <><div className="settings-tabs mt-6" role="tablist" aria-label="Account type"><button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => { setMode('new'); setMessage(null); }} className="px-3 py-3 text-sm">New account</button><button type="button" role="tab" aria-selected={mode === 'existing'} onClick={() => { setMode('existing'); setMessage(null); }} className="px-3 py-3 text-sm">I have an account</button></div>{message && <Alert className="mt-4" variant={message.type === 'info' ? 'info' : message.type}>{message.text}</Alert>}
    {mode === 'new' ? <form onSubmit={submit} className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Input label="First name" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} /><Input label="Last name" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></div><Input label="Password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} helperText="At least 8 characters" /><Button className="w-full" type="submit" isLoading={busy} disabled={!onAccept || previewReadOnly}>{onAccept && <Check aria-hidden="true" className="h-4 w-4" />}{onAccept && !previewReadOnly ? 'Create account & continue' : 'Acceptance unavailable'}</Button><p className="text-center text-xs leading-5 text-slate-500">We’ll verify your email before activating workspace access.</p></form> : <div className="mt-5 space-y-4"><p className="text-sm leading-6 text-slate-600">Sign in with <strong className="font-medium text-brand-navy">{invite.email}</strong>. If you need to reset your password, use the existing account recovery flow.</p><Button asChild className="w-full"><Link href={`/login?next=${encodeURIComponent(returnPath)}`}><UserRound aria-hidden="true" className="h-4 w-4" />Sign in to STACK37</Link></Button><Link className="block text-center text-sm text-brand-blue hover:underline" href="/forgot-password">Forgot password?</Link></div>}</>}
    {reviewMode && <p className="mt-6 text-center text-xs text-slate-400">Local visual review · mock invitation</p>}</section></main>;
}
