/**
 * TenantManagement — tenant roster with expandable detail panel.
 * Rendered inside AdminPanel when the "tenants" section is active.
 */

import { useState, useEffect, useCallback } from 'react';
import { DataTable, BadgeCell } from '../../components/shared/DataTable';
import TenantDetailPanel from './TenantDetailPanel';
import { fetchAdminTenants } from '../../services/analyticsApi';
import type { AdminTenant } from '../../types/analytics';
import type { Column } from '../../components/shared/DataTable';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  churned: 'bg-red-100 text-red-700',
};

export default function TenantManagement() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAdminTenants();
      setTenants(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const columns: Column<AdminTenant>[] = [
    {
      key: 'companyName',
      header: 'Company',
      sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-slate-900">{row.companyName}</span>
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
      key: 'subscriptionTier',
      header: 'Tier',
      sortable: true,
      render: (row) => (
        <span className="text-sm capitalize text-slate-700">{row.subscriptionTier}</span>
      ),
    },
    {
      key: 'networkName',
      header: 'Network',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-500">{row.networkName || '\u2014'}</span>
      ),
    },
    {
      key: 'has_stripe',
      header: 'Stripe',
      render: (row) => (
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${row.has_stripe ? 'bg-emerald-500' : 'bg-slate-300'}`}
          title={row.has_stripe ? 'Connected' : 'Not connected'}
          aria-label={`Stripe ${row.has_stripe ? 'connected' : 'not connected'}`}
        />
      ),
    },
    {
      key: 'has_clerk',
      header: 'Clerk',
      render: (row) => (
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${row.has_clerk ? 'bg-emerald-500' : 'bg-slate-300'}`}
          title={row.has_clerk ? 'Connected' : 'Not connected'}
          aria-label={`Clerk ${row.has_clerk ? 'connected' : 'not connected'}`}
        />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-500">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '\u2014'}
        </span>
      ),
    },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading tenants">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-40" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const handleRowClick = (tenant: AdminTenant) => {
    setExpandedTenantId(prev => (prev === tenant.tenantId ? null : tenant.tenantId));
  };

  const handleTenantUpdated = (updated: AdminTenant) => {
    setTenants(prev =>
      prev.map(t => (t.tenantId === updated.tenantId ? { ...t, ...updated } : t))
    );
    setSuccessMessage(`Updated ${updated.companyName}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div>
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
      {successMessage && (
        <div
          className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}

      <DataTable
        title="Tenants"
        subtitle={`${tenants.length} registered tenants`}
        columns={columns}
        data={tenants}
        rowKey="tenantId"
        totalCount={tenants.length}
        page={1}
        pageSize={tenants.length || 1}
        onPageChange={() => {}}
        onRowClick={handleRowClick}
        showActions={false}
      />

      {expandedTenantId && (
        <TenantDetailPanel
          tenantId={expandedTenantId}
          onClose={() => setExpandedTenantId(null)}
          onUpdated={handleTenantUpdated}
        />
      )}
    </div>
  );
}
