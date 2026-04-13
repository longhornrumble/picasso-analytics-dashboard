/**
 * TenantDetailPanel — expandable detail + edit panel for a single tenant.
 * Rendered below the DataTable row when a tenant is selected.
 *
 * Fetches: detail, employees (graceful fallback), billing (graceful fallback).
 * Editable fields: status, subscriptionTier, networkId, networkName.
 */

import { useState, useEffect } from 'react';
import {
  fetchAdminTenantDetail,
  updateAdminTenant,
  fetchAdminTenantBilling,
  fetchAdminTenantEmployees,
} from '../../services/analyticsApi';
import type {
  AdminTenant,
  AdminEmployee,
  StripeBillingEvent,
  TenantStatus,
  SubscriptionTier,
} from '../../types/analytics';

interface Props {
  tenantId: string;
  onClose: () => void;
  onUpdated: (tenant: AdminTenant) => void;
}

export default function TenantDetailPanel({ tenantId, onClose, onUpdated }: Props) {
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [billing, setBilling] = useState<StripeBillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable local state — seeded from fetched tenant
  const [editStatus, setEditStatus] = useState<TenantStatus>('active');
  const [editTier, setEditTier] = useState<SubscriptionTier>('free');
  const [editNetworkId, setEditNetworkId] = useState('');
  const [editNetworkName, setEditNetworkName] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [detail, emps, bill] = await Promise.all([
          fetchAdminTenantDetail(tenantId),
          fetchAdminTenantEmployees(tenantId).catch(() => [] as AdminEmployee[]),
          fetchAdminTenantBilling(tenantId).catch(() => [] as StripeBillingEvent[]),
        ]);
        if (cancelled) return;
        setTenant(detail);
        setEmployees(emps);
        setBilling(bill);
        setEditStatus(detail.status);
        setEditTier(detail.subscriptionTier);
        setEditNetworkId(detail.networkId || '');
        setEditNetworkName(detail.networkName || '');
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tenant');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const hasChanges =
    tenant !== null && (
      editStatus !== tenant.status ||
      editTier !== tenant.subscriptionTier ||
      (editNetworkId || null) !== (tenant.networkId || null) ||
      (editNetworkName || null) !== (tenant.networkName || null)
    );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminTenant(tenantId, {
        status: editStatus,
        subscriptionTier: editTier,
        networkId: editNetworkId || null,
        networkName: editNetworkName || null,
      });
      setTenant(updated);
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="mt-4 bg-white rounded-xl border border-slate-200 p-6 animate-pulse"
        aria-busy="true"
        aria-label="Loading tenant details"
      >
        <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-slate-100 rounded w-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="mt-4 bg-white rounded-xl border border-slate-200 p-6"
      role="region"
      aria-label={`Tenant detail: ${tenant.companyName}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{tenant.companyName}</h3>
        <button
          onClick={onClose}
          aria-label="Close tenant detail panel"
          className="text-slate-400 hover:text-slate-600 text-sm"
        >
          Close
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Read-only identifiers */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Identifiers</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">Tenant ID:</dt>
              <dd className="font-mono text-slate-700 break-all">{tenant.tenantId}</dd>
            </div>
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">Tenant Hash:</dt>
              <dd className="font-mono text-slate-700 break-all">{tenant.tenantHash}</dd>
            </div>
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">S3 Config:</dt>
              <dd className="font-mono text-slate-700 break-all">{tenant.s3ConfigPath}</dd>
            </div>
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">Clerk Org:</dt>
              <dd className="font-mono text-slate-700">{tenant.clerkOrgId || '\u2014'}</dd>
            </div>
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">Stripe ID:</dt>
              <dd className="font-mono text-slate-700">{tenant.stripeCustomerId || '\u2014'}</dd>
            </div>
            <div className="flex">
              <dt className="text-slate-500 w-32 shrink-0">Onboarded:</dt>
              <dd className="text-slate-700">
                {tenant.onboardedAt ? new Date(tenant.onboardedAt).toLocaleDateString() : '\u2014'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Editable configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Configuration</h4>

          <div>
            <label htmlFor={`status-${tenantId}`} className="block text-sm text-slate-600 mb-1">
              Status
            </label>
            <select
              id={`status-${tenantId}`}
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as TenantStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          <div>
            <label htmlFor={`tier-${tenantId}`} className="block text-sm text-slate-600 mb-1">
              Subscription Tier
            </label>
            <select
              id={`tier-${tenantId}`}
              value={editTier}
              onChange={e => setEditTier(e.target.value as SubscriptionTier)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="free">Free</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label htmlFor={`networkId-${tenantId}`} className="block text-sm text-slate-600 mb-1">
              Network ID
            </label>
            <input
              id={`networkId-${tenantId}`}
              type="text"
              value={editNetworkId}
              onChange={e => setEditNetworkId(e.target.value)}
              placeholder="e.g., NET001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor={`networkName-${tenantId}`} className="block text-sm text-slate-600 mb-1">
              Network Name
            </label>
            <input
              id={`networkName-${tenantId}`}
              type="text"
              value={editNetworkName}
              onChange={e => setEditNetworkName(e.target.value)}
              placeholder="e.g., Partner Network"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            aria-disabled={!hasChanges || saving}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasChanges && !saving
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Team members */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
          Team Members {employees.length > 0 && `(${employees.length})`}
        </h4>
        {employees.length > 0 ? (
          <ul className="space-y-2">
            {employees.map(emp => (
              <li
                key={emp.clerkUserId}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm"
              >
                <div>
                  <span className="font-medium text-slate-700">{emp.name || emp.email}</span>
                  {emp.name && (
                    <span className="text-slate-400 ml-2">{emp.email}</span>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    emp.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {emp.role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No team members found. Run the employee backfill or invite employees from the Employee Management tab.</p>
        )}
      </div>

      {/* Billing events */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
          Recent Billing Events
        </h4>
        {billing.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 font-medium">Next</th>
                </tr>
              </thead>
              <tbody>
                {billing.map((evt, i) => {
                  const d = evt.detail;
                  const amount = d.amount_paid || d.amount_due;
                  const currency = (d.currency || 'usd').toUpperCase();
                  const statusColors: Record<string, string> = {
                    paid: 'bg-emerald-100 text-emerald-700',
                    active: 'bg-emerald-100 text-emerald-700',
                    open: 'bg-blue-100 text-blue-700',
                    draft: 'bg-slate-100 text-slate-600',
                    past_due: 'bg-red-100 text-red-700',
                    canceled: 'bg-red-100 text-red-700',
                    uncollectible: 'bg-red-100 text-red-700',
                  };
                  const eventLabels: Record<string, string> = {
                    'invoice.paid': 'Invoice Paid',
                    'invoice.payment_succeeded': 'Payment Succeeded',
                    'invoice.payment_failed': 'Payment Failed',
                    'invoice.finalized': 'Invoice Finalized',
                    'invoice.upcoming': 'Upcoming Invoice',
                    'customer.subscription.created': 'Subscription Created',
                    'customer.subscription.updated': 'Subscription Updated',
                    'customer.subscription.deleted': 'Subscription Canceled',
                  };
                  const label = eventLabels[evt.stripe_event_type] || evt.stripe_event_type;
                  const nextDate = d.next_payment_attempt || d.period_end || d.due_date;

                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-700">{label}</td>
                      <td className="py-2.5 pr-4 font-medium text-slate-700">
                        {amount != null
                          ? `${currency === 'USD' ? '$' : currency + ' '}${(amount / 100).toFixed(2)}`
                          : '\u2014'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {d.status ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[d.status] || 'bg-slate-100 text-slate-600'}`}>
                            {d.status}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleDateString() : '\u2014'}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {nextDate ? new Date(nextDate).toLocaleDateString() : '\u2014'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No Stripe events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
