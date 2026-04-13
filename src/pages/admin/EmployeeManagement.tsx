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
} from '../../services/analyticsApi';
import type { AdminTenant, AdminEmployee } from '../../types/analytics';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [showInviteModal, setShowInviteModal] = useState(false);

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

  const loadTenants = useCallback(async () => {
    try {
      const data = await fetchAdminTenants();
      setTenants(data);
    } catch (err) {
      // Non-fatal — tenant filter will be empty but employees can still load
      console.warn('Failed to load tenants for filter:', err);
    }
  }, []);

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

  // Initial mount — fetch tenants and employees in parallel
  useEffect(() => {
    setLoading(true);
    loadTenants();
    loadEmployees('', '');
  }, [loadTenants, loadEmployees]);

  // Tenant filter change — immediate refetch
  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedTenantId(value);
    setLoading(true);
    loadEmployees(value, searchQuery);
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
      await updateAdminEmployee(employee.tenantId, employee.clerkUserId, { role: newRole });
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
      await updateAdminEmployee(employee.tenantId, employee.clerkUserId, { status: 'inactive' });
      showSuccess(`Deactivated ${employee.name || employee.email}`);
      loadEmployees(selectedTenantId, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate employee');
    } finally {
      setConfirmAction(null);
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
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white hover:border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
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

  // Invite button injected into DataTable header
  const inviteButton = (
    <button
      onClick={() => { setError(null); setShowInviteModal(true); }}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Invite Employee
    </button>
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

        {/* Tenant filter */}
        {tenantFilter}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Invite button */}
        {inviteButton}
      </div>

      <DataTable<EmployeeRow>
        title="Employees"
        subtitle={`${employees.length} employee${employees.length !== 1 ? 's' : ''}`}
        columns={columns}
        data={employees}
        rowKey="clerkUserId"
        totalCount={employees.length}
        page={1}
        pageSize={employees.length || 1}
        onPageChange={() => {}}
        showSearch={false}
        showFilter={false}
        showActions
        renderActions={(row) => (
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
        )}
        emptyMessage="No employees found. Adjust the tenant filter or search query."
      />

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
