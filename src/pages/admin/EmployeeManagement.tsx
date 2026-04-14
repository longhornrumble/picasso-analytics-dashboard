/**
 * EmployeeManagement — cross-tenant employee roster for Super Admin.
 * Rendered inside AdminPanel when the "employees" section is active.
 *
 * Features:
 *   - Tenant filter dropdown (all tenants or scoped to one)
 *   - Debounced search (300ms) by email/name
 *   - Inline role dropdown with confirmation dialog
 *   - Deactivate action with destructive confirmation dialog
 *   - Invite Employee button → InviteEmployeeModal
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DataTable, BadgeCell, TwoLineCell } from '../../components/shared/DataTable';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import InviteEmployeeModal from './InviteEmployeeModal';
import {
  fetchAdminTenants,
  fetchAdminEmployees,
  updateAdminEmployee,
  addAdminEmployee,
  fetchAdminTenantInvitations,
  revokeAdminTenantInvitation,
} from '../../services/analyticsApi';
import type { AdminTenant, AdminEmployee, AdminInvitation } from '../../types/analytics';
import type { Column } from '../../components/shared/DataTable';

// AdminEmployee extended with optional companyName from cross-tenant enrichment
type EmployeeRow = AdminEmployee & { companyName?: string };

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  pending: 'bg-amber-100 text-amber-700',
};

export default function EmployeeManagement() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // UI state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role_change' | 'deactivate';
    employee: EmployeeRow;
    newRole?: string;
  } | null>(null);

  // Debounce timer ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadEmployees = useCallback(async (tenantId: string, search: string) => {
    try {
      setError(null);
      const params: { tenant_id?: string; search?: string } = {};
      if (tenantId) params.tenant_id = tenantId;
      if (search.trim()) params.search = search.trim();
      const data = await fetchAdminEmployees(params);
      setEmployees(data.employees as EmployeeRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvitations = useCallback(async (tenantFilter: string, tenantsList: AdminTenant[]) => {
    try {
      if (tenantFilter) {
        const invs = await fetchAdminTenantInvitations(tenantFilter);
        setInvitations(invs);
      } else {
        // Fetch for all tenants in parallel
        const results = await Promise.all(
          tenantsList.map(t => fetchAdminTenantInvitations(t.tenantId).catch(() => [] as AdminInvitation[]))
        );
        setInvitations(results.flat());
      }
    } catch {
      setInvitations([]);
    }
  }, []);

  // Initial mount — fetch tenants, employees, and invitations
  useEffect(() => {
    setLoading(true);
    // Fetch tenants first so we have the list for the all-tenants invitation query
    fetchAdminTenants()
      .then((data) => {
        setTenants(data);
        loadInvitations('', data);
      })
      .catch((err) => {
        console.warn('Failed to load tenants for filter:', err);
        // Still attempt invitation load — will result in empty list
        loadInvitations('', []);
      });
    loadEmployees('', '');
  }, [loadEmployees, loadInvitations]);

  // Tenant filter change — immediate refetch
  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedTenantId(value);
    setLoading(true);
    loadEmployees(value, searchQuery);
    loadInvitations(value, tenants);
  };

  // Search input — debounced 300ms
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setLoading(true);
      loadEmployees(selectedTenantId, value);
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRoleChange = async (employee: EmployeeRow, newRole: string) => {
    try {
      await updateAdminEmployee(employee.tenantId, employee.employeeId, { role: newRole });
      showSuccess(`Updated ${employee.name || employee.email} to ${newRole}`);
      loadEmployees(selectedTenantId, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleDeactivate = async (employee: EmployeeRow) => {
    try {
      await updateAdminEmployee(employee.tenantId, employee.employeeId, { status: 'inactive' });
      showSuccess(`Deactivated ${employee.name || employee.email}`);
      loadEmployees(selectedTenantId, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate employee');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleAddContact = async (data: { name: string; email: string; role: string; phone?: string; notificationPrefs?: { email?: boolean; sms?: boolean } }) => {
    if (!selectedTenantId) {
      setError('Select a tenant before adding a contact');
      return;
    }
    try {
      await addAdminEmployee(selectedTenantId, data);
      showSuccess(`Contact ${data.email} added`);
      setShowAddContactModal(false);
      loadEmployees(selectedTenantId, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    }
  };

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      render: (row) => (
        <TwoLineCell
          primary={row.name || 'Unnamed'}
          secondary={row.email}
        />
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        row.type === 'local_only' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Contact
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            Portal User
          </span>
        )
      ),
    },
    {
      key: 'companyName',
      header: 'Tenant',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.companyName || tenants.find(t => t.tenantId === row.tenantId)?.companyName || row.tenantId}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        row.type === 'local_only' ? (
          <span className="text-sm text-slate-400">{'\u2014'}</span>
        ) : (
          <select
            value={row.role}
            onChange={(e) => {
              const newRole = e.target.value;
              if (newRole !== row.role) {
                setConfirmAction({ type: 'role_change', employee: row, newRole });
              }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Change role for ${row.name || row.email}`}
            className="text-sm border border-slate-200 rounded-lg pl-2.5 pr-8 py-1.5 text-slate-700 bg-white hover:border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2364748b%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        )
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <BadgeCell value={row.status} colorMap={STATUS_COLORS} />
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-500">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '\u2014'}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading employees">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Build tenant name lookup for the invitations section
  const tenantNames: Record<string, string> = {};
  tenants.forEach(t => { tenantNames[t.tenantId] = t.companyName; });

  // Tenant filter dropdown (injected into DataTable via filterComponent)
  const tenantFilter = (
    <select
      value={selectedTenantId}
      onChange={handleTenantChange}
      aria-label="Filter by tenant"
      className="h-9 pl-3 pr-8 border border-gray-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
    >
      <option value="">All tenants</option>
      {tenants.map((t) => (
        <option key={t.tenantId} value={t.tenantId}>
          {t.companyName}
        </option>
      ))}
    </select>
  );

  // Header action buttons
  const headerButtons = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => { setError(null); setShowAddContactModal(true); }}
        disabled={!selectedTenantId}
        title={!selectedTenantId ? 'Select a tenant first' : 'Add a contact who receives notifications but does not log in'}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Add Contact
      </button>
      <button
        onClick={() => { setError(null); setShowInviteModal(true); }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Invite Employee
      </button>
    </div>
  );

  return (
    <div>
      {/* Error alert */}
      {error && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="text-red-400 hover:text-red-600 ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div
          className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}

      {/* Search input positioned above the table, outside DataTable's built-in search
          because we need full control over debounce and the filter lives alongside it */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search employees"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
          aria-label="Filter by status"
          className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2364748b%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>

        {/* Tenant filter */}
        {tenantFilter}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {headerButtons}
      </div>

      {(() => {
        const filteredEmployees = statusFilter === 'all'
          ? employees
          : employees.filter(e => e.status === statusFilter);
        return (<DataTable<EmployeeRow>
        title="Employees"
        subtitle={`${filteredEmployees.length} employee${filteredEmployees.length !== 1 ? 's' : ''}${statusFilter !== 'all' ? ` (${statusFilter})` : ''}`}
        columns={columns}
        data={filteredEmployees}
        rowKey="employeeId"
        totalCount={filteredEmployees.length}
        page={1}
        pageSize={filteredEmployees.length || 1}
        onPageChange={() => {}}
        showSearch={false}
        showFilter={false}
        showActions
        renderActions={(row) => (
          row.type === 'local_only' ? (
            <button
              onClick={(e) => e.stopPropagation()}
              disabled
              title="Remove via Admin panel — contact removal not available here"
              aria-label={`Remove ${row.name || row.email} — use Admin panel`}
              className="text-xs text-red-400 font-medium opacity-40 cursor-not-allowed"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: 'deactivate', employee: row });
              }}
              disabled={row.status === 'inactive'}
              aria-label={`Deactivate ${row.name || row.email}`}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Deactivate
            </button>
          )
        )}
        emptyMessage="No employees found. Adjust the tenant filter or search query."
      />);
      })()}

      {/* Pending Invitations */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
          Pending Invitations {invitations.length > 0 && `(${invitations.length})`}
        </h4>
        {invitations.length > 0 ? (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.invitation_id}
                className="flex items-center justify-between px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{inv.email}</p>
                    <p className="text-xs text-slate-500">
                      Invited as {inv.role === 'admin' ? 'Admin' : 'Member'} to {tenantNames[inv.tenant_id] || inv.tenant_id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await revokeAdminTenantInvitation(inv.tenant_id, inv.invitation_id);
                      setInvitations(prev => prev.filter(i => i.invitation_id !== inv.invitation_id));
                    } catch {
                      // Silently swallow — no inline error surface here
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No pending invitations.</p>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteEmployeeModal
          tenants={tenants}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            showSuccess('Invitation sent');
            loadEmployees(selectedTenantId, searchQuery);
          }}
        />
      )}

      {/* Add Contact modal */}
      {showAddContactModal && (
        <AddContactModal
          tenantName={tenants.find(t => t.tenantId === selectedTenantId)?.companyName || selectedTenantId}
          onClose={() => setShowAddContactModal(false)}
          onAdd={handleAddContact}
        />
      )}

      {/* Confirmation dialog — role change */}
      {confirmAction?.type === 'role_change' && (
        <ConfirmDialog
          title="Change Role"
          message={`Change ${confirmAction.employee.name || confirmAction.employee.email}'s role to ${confirmAction.newRole}?`}
          confirmLabel="Change Role"
          onConfirm={() => handleRoleChange(confirmAction.employee, confirmAction.newRole!)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Confirmation dialog — deactivate (destructive) */}
      {confirmAction?.type === 'deactivate' && (
        <ConfirmDialog
          title="Deactivate Employee"
          message={`Deactivate ${confirmAction.employee.name || confirmAction.employee.email}? They will lose portal access.`}
          confirmLabel="Deactivate"
          destructive
          onConfirm={() => handleDeactivate(confirmAction.employee)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Add Contact Modal — admin variant (tenant-scoped)
// =============================================================================
import { createPortal } from 'react-dom';

interface AddContactModalProps {
  tenantName: string;
  onClose: () => void;
  onAdd: (data: { name: string; email: string; role: string; phone?: string; notificationPrefs?: { email?: boolean; sms?: boolean } }) => Promise<void>;
}

// Phone formatting utilities
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  const local = digits.startsWith('1') && digits.length > 10 ? digits.slice(1) : digits;
  if (local.length <= 3) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

function validatePhone(value: string): string | null {
  if (!value.trim()) return null;
  const normalized = normalizePhone(value);
  if (!/^\+1\d{10}$/.test(normalized)) return 'Enter a valid US phone number (e.g. 512-555-1234)';
  return null;
}

function AddContactModal({ tenantName, onClose, onAdd }: AddContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
    setPhoneError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (phone.trim()) {
      const err = validatePhone(phone);
      if (err) { setPhoneError(err); return; }
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      await onAdd({
        name: name.trim(),
        email: email.trim(),
        role: 'member',
        phone: phone.trim() ? normalizePhone(phone) : undefined,
        notificationPrefs: { email: emailNotif, sms: smsNotif },
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to add contact');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-contact-modal-title">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 id="add-contact-modal-title" className="text-lg font-semibold text-slate-800 mb-1">Add Contact</h3>
        <p className="text-sm text-slate-500 mb-4">For {tenantName}. Contacts receive notifications but do not log in.</p>

        {localError && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ac-name" className="block text-sm font-medium text-slate-700 mb-1">Name <span aria-hidden="true">*</span></label>
            <input
              id="ac-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label htmlFor="ac-email" className="block text-sm font-medium text-slate-700 mb-1">Email <span aria-hidden="true">*</span></label>
            <input
              id="ac-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label htmlFor="ac-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              id="ac-phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(512) 555-1234"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Notification Preferences</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotif}
                  onChange={(e) => setEmailNotif(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Email notifications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsNotif}
                  onChange={(e) => setSmsNotif(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">SMS notifications</span>
              </label>
            </div>
          </fieldset>
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
              disabled={submitting || !name.trim() || !email.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
