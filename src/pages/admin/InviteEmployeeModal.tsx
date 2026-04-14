/**
 * InviteEmployeeModal — Super Admin modal for inviting an employee to any tenant.
 * Uses createPortal to render above all other UI layers.
 *
 * Props:
 *   tenants   — full tenant list for the tenant selector dropdown
 *   onClose   — called when the modal should be dismissed without action
 *   onInvited — called after a successful invite (triggers list refresh in parent)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { inviteAdminEmployee } from '../../services/analyticsApi';
import type { AdminTenant } from '../../types/analytics';

interface Props {
  tenants: AdminTenant[];
  onClose: () => void;
  onInvited: () => void;
}

export default function InviteEmployeeModal({ tenants, onClose, onInvited }: Props) {
  const [tenantId, setTenantId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus first interactive element on mount (WCAG 2.4.3)
  const firstInputRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape key (WCAG 2.1.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !email.trim()) return;

    setSending(true);
    setError(null);
    try {
      await inviteAdminEmployee(tenantId, email.trim(), role, firstName.trim(), lastName.trim());
      onInvited();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const isValid = tenantId !== '' && email.trim() !== '';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-employee-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="invite-employee-title" className="text-lg font-semibold text-slate-800">
            Invite Employee
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tenant selector */}
          <div>
            <label htmlFor="invite-emp-tenant" className="block text-sm font-medium text-slate-700 mb-1">
              Tenant
            </label>
            <select
              id="invite-emp-tenant"
              ref={firstInputRef}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a tenant...</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-first-name" className="block text-sm font-medium text-slate-700 mb-1">
                First Name
              </label>
              <input
                id="invite-first-name"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="invite-last-name" className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <input
                id="invite-last-name"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="invite-emp-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="invite-emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@company.com"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="invite-emp-role" className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              id="invite-emp-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="member">Member — View analytics, read-only settings</option>
              <option value="admin">Admin — Full access, manage team</option>
            </select>
          </div>

          {/* Actions */}
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
              disabled={sending || !isValid}
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
