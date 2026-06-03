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
  fetchAdminTenantInvitations,
  revokeAdminTenantInvitation,
  purgeTenant,
  type TenantPurgeResult,
} from '../../services/analyticsApi';
import type {
  AdminTenant,
  AdminEmployee,
  AdminInvitation,
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
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
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
        const [detail, emps, bill, invs] = await Promise.all([
          fetchAdminTenantDetail(tenantId),
          fetchAdminTenantEmployees(tenantId).catch(() => [] as AdminEmployee[]),
          fetchAdminTenantBilling(tenantId).catch(() => [] as StripeBillingEvent[]),
          fetchAdminTenantInvitations(tenantId).catch(() => [] as AdminInvitation[]),
        ]);
        if (cancelled) return;
        setTenant(detail);
        setEmployees(emps);
        setBilling(bill);
        setInvitations(invs);
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

  // ── Danger Zone: tenant data purge (preview → typed-confirm → delete) ────────
  const [purgePreview, setPurgePreview] = useState<TenantPurgeResult | null>(null);
  const [purgeResult, setPurgeResult] = useState<TenantPurgeResult | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  const resetPurge = () => {
    setPurgePreview(null);
    setPurgeResult(null);
    setPurgeError(null);
    setPurgeConfirmText('');
  };

  const handlePurgePreview = async () => {
    setPurgeBusy(true);
    setPurgeError(null);
    try {
      setPurgePreview(await purgeTenant(tenantId, { dryRun: true }));
    } catch (err: unknown) {
      setPurgeError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPurgeBusy(false);
    }
  };

  const handlePurgeConfirm = async () => {
    if (purgeConfirmText !== tenantId) return;
    setPurgeBusy(true);
    setPurgeError(null);
    try {
      setPurgeResult(await purgeTenant(tenantId, { dryRun: false, graceConfirmed: true }));
      setPurgePreview(null);
    } catch (err: unknown) {
      setPurgeError(err instanceof Error ? err.message : 'Purge failed');
    } finally {
      setPurgeBusy(false);
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
                key={emp.employeeId}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-slate-700">{emp.name || emp.email}</span>
                  {emp.name && (
                    <span className="text-slate-400">{emp.email}</span>
                  )}
                  {emp.type === 'local_only' && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                      Contact
                    </span>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
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
                      Invited as {inv.role === 'admin' ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await revokeAdminTenantInvitation(tenantId, inv.invitation_id);
                      setInvitations(prev => prev.filter(i => i.invitation_id !== inv.invitation_id));
                    } catch {
                      // Silently swallow — inline error surfacing not wired here
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

      {/* ── Danger Zone: tenant data purge (preview → typed-confirm → delete) ── */}
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50/40 p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger Zone — Delete tenant data</h3>
        <p className="mt-1 text-xs text-red-600/80">
          Permanently deletes this tenant&apos;s conversational PII (form submissions,
          notifications, subject index, SMS usage). Consent/opt-out proof, email
          suppression, and audit records are retained. This cannot be undone.
        </p>

        {purgeError && <p className="mt-2 text-xs font-medium text-red-700">{purgeError}</p>}

        {purgeResult ? (
          <div className="mt-3 text-xs text-slate-700">
            <p className="font-medium text-red-700">
              {purgeResult.deleted ? 'Deleted.' : 'Completed (no deletion).'} purge_id:{' '}
              <span className="font-mono">{purgeResult.purge_id}</span>
            </p>
            <ul className="ml-4 mt-1 list-disc">
              {Object.entries(purgeResult.rows_touched).map(([k, v]) => (
                <li key={k}>{k}: <span className="font-medium">{v}</span></li>
              ))}
            </ul>
            {purgeResult.manual_followups.length > 0 && (
              <ul className="ml-4 mt-1 list-disc text-amber-700">
                {purgeResult.manual_followups.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
            <button onClick={resetPurge} className="mt-2 text-xs text-slate-500 underline">Done</button>
          </div>
        ) : purgePreview ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-700">This will delete:</p>
            <ul className="ml-4 mt-1 list-disc text-xs text-slate-600">
              {Object.entries(purgePreview.rows_touched).map(([k, v]) => (
                <li key={k}>{k}: <span className="font-medium">{v}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium text-slate-700">Retained (never deleted):</p>
            <ul className="ml-4 mt-1 list-disc text-xs text-slate-500">
              {purgePreview.carve_outs_retained.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <label className="mt-3 block text-xs text-slate-600">
              Type <span className="font-mono font-semibold text-red-700">{tenantId}</span> to confirm:
              <input
                type="text"
                value={purgeConfirmText}
                onChange={e => setPurgeConfirmText(e.target.value)}
                className="mt-1 block w-full rounded border border-red-300 px-2 py-1 text-sm"
                placeholder={tenantId}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handlePurgeConfirm}
                disabled={purgeBusy || purgeConfirmText !== tenantId}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {purgeBusy ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button onClick={resetPurge} disabled={purgeBusy} className="rounded px-3 py-1.5 text-xs text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handlePurgePreview}
            disabled={purgeBusy}
            className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-40"
          >
            {purgeBusy ? 'Loading preview…' : 'Delete tenant data…'}
          </button>
        )}
      </div>
    </div>
  );
}
