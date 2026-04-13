/**
 * Team Management Page
 * Phase 3 — Member roster, invitations, role management
 * Custom UI backed by Clerk Backend API via Lambda proxy
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import {
  fetchTeamMembers,
  fetchTeamInvitations,
  inviteTeamMember,
  revokeTeamInvitation,
  updateTeamMemberRole,
  removeTeamMember,
} from '../services/analyticsApi';
import type {
  TeamMember,
  TeamMembersResponse,
  TeamInvitation,
  TeamMemberRole,
} from '../types/analytics';

export function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role_change' | 'remove';
    membershipId: string;
    memberName: string;
    newRole?: TeamMemberRole;
  } | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const data: TeamMembersResponse = await fetchTeamMembers();
      setMembers(data.members);
      setAdminCount(data.admin_count);
      setCanEdit(data.can_edit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const data = await fetchTeamInvitations();
      setInvitations(data.invitations);
    } catch {
      // Non-critical — members who can't see invitations will get a 403 which is expected
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMembers();
      await loadInvitations();
      setLoading(false);
    })();
  }, [loadMembers, loadInvitations]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleRoleChange = async (membershipId: string, newRole: TeamMemberRole) => {
    clearMessages();
    try {
      await updateTeamMemberRole(membershipId, newRole);
      setSuccessMsg('Role updated successfully');
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
    setConfirmAction(null);
  };

  const handleRemove = async (membershipId: string) => {
    clearMessages();
    try {
      await removeTeamMember(membershipId);
      setSuccessMsg('Member removed');
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
    setConfirmAction(null);
  };

  const handleRevoke = async (invitationId: string) => {
    clearMessages();
    try {
      await revokeTeamInvitation(invitationId);
      setSuccessMsg('Invitation revoked');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-3 bg-slate-100 rounded w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Team Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { clearMessages(); setShowInviteModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg" role="status">
          <p className="text-sm text-emerald-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Member roster */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Member</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden sm:table-cell">Joined</th>
                {canEdit && (
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {members.map((member) => {
                const isLastAdmin = member.role === 'admin' && adminCount <= 1;
                const isSelf = member.user_id === user?.tenant_id; // approximate — backend enforces real guard
                const initials = member.name
                  ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : member.email[0].toUpperCase();

                return (
                  <tr key={member.membership_id} className="hover:bg-slate-50/50">
                    {/* Name + Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.image_url ? (
                          <img src={member.image_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary-700">{initials}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{member.name || 'Unnamed'}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      {canEdit && !isLastAdmin ? (
                        <select
                          value={member.role}
                          onChange={(e) => {
                            const newRole = e.target.value as TeamMemberRole;
                            if (newRole !== member.role) {
                              setConfirmAction({
                                type: 'role_change',
                                membershipId: member.membership_id,
                                memberName: member.name || member.email,
                                newRole,
                              });
                            }
                          }}
                          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white hover:border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          member.role === 'admin'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                          {isLastAdmin && canEdit && (
                            <span className="ml-1 text-amber-500" title="At least one admin is required">*</span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-slate-500">
                        {member.joined_at ? new Date(typeof member.joined_at === 'number' ? member.joined_at : member.joined_at).toLocaleDateString() : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        {!isLastAdmin && !isSelf && (
                          <button
                            onClick={() => setConfirmAction({
                              type: 'remove',
                              membershipId: member.membership_id,
                              memberName: member.name || member.email,
                            })}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {canEdit && invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">
            Pending Invitations ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.invitation_id}
                className="flex items-center justify-between px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{inv.email}</p>
                    <p className="text-xs text-slate-500">
                      Invited as {inv.role === 'admin' ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(inv.invitation_id)}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvited={async () => {
            setShowInviteModal(false);
            setSuccessMsg('Invitation sent');
            await loadInvitations();
          }}
          onError={(msg) => { setShowInviteModal(false); setError(msg); }}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'remove' ? 'Remove Member' : 'Change Role'}
          message={
            confirmAction.type === 'remove'
              ? `Are you sure you want to remove ${confirmAction.memberName} from the team? They will lose access to the portal.`
              : `Change ${confirmAction.memberName}'s role to ${confirmAction.newRole}?`
          }
          confirmLabel={confirmAction.type === 'remove' ? 'Remove' : 'Change Role'}
          destructive={confirmAction.type === 'remove'}
          onConfirm={() => {
            if (confirmAction.type === 'remove') {
              handleRemove(confirmAction.membershipId);
            } else if (confirmAction.newRole) {
              handleRoleChange(confirmAction.membershipId, confirmAction.newRole);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}


/**
 * Invite Member Modal
 */
function InviteModal({
  onClose,
  onInvited,
  onError,
}: {
  onClose: () => void;
  onInvited: () => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('member');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      await inviteTeamMember(email.trim(), role);
      onInvited();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const [roleOpen, setRoleOpen] = useState(false);
  const roleOptions: { value: TeamMemberRole; label: string }[] = [
    { value: 'member', label: 'Member — View analytics, read-only settings' },
    { value: 'admin', label: 'Admin — Full access, manage team' },
  ];
  const selectedLabel = roleOptions.find(o => o.value === role)?.label || '';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Invite Team Member</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <button
              type="button"
              onClick={() => setRoleOpen(!roleOpen)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-left bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 flex items-center justify-between"
            >
              <span>{selectedLabel}</span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${roleOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {roleOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setRole(opt.value); setRoleOpen(false); }}
                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-slate-100 transition-colors ${
                      role === opt.value ? 'text-primary-600 font-medium bg-primary-50' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

