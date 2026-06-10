/**
 * SchedulingPage — Customer Portal "Scheduling" tab container (WS-E-PORTAL, E12 + E15).
 *
 * Wires the orphaned render slices (MyBookings = Surface 2, SchedulingAnalytics =
 * Surface 8) into the app: derives the viewer from Clerk/JWT auth, loads bookings via
 * the §E7-backed useBookings hook, and presents them under sub-tabs (mirrors the
 * SettingsPage sub-tab pattern). Behind the default-off `dashboard_scheduling` feature
 * flag (D1 Flag A entitlement) — no tenant sees this until scheduling is enabled.
 */
import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import type { SchedulingViewer } from '../../types/scheduling';
import { useBookings } from '../../lib/scheduling/useBookings';
import { useAppointmentTypeNames } from '../../lib/scheduling/useAppointmentTypeNames';
import { MyBookings } from './MyBookings';
import { SchedulingAnalytics } from './SchedulingAnalytics';

type SchedulingSubTab = 'bookings' | 'analytics';

export function SchedulingPage() {
  const { user } = useAuth();
  const viewer: SchedulingViewer = { role: user?.role, email: user?.email };
  const isAdmin = viewer.role === 'admin' || viewer.role === 'super_admin';

  // ui_plan §8: admins read the tenant aggregate; staff read only their own.
  const { bookings, loading, error, reload } = useBookings(
    isAdmin ? 'tenant_aggregate' : 'staff_self',
  );
  // Appointment-type names resolve raw ids in the bookings list + the per-type analytics
  // breakdown. The endpoint is admin-only, so the map is empty for staff (ids fall back).
  const { names: appointmentTypeNames } = useAppointmentTypeNames(isAdmin);
  const [activeSubTab, setActiveSubTab] = useState<SchedulingSubTab>('bookings');

  const subTabs: { id: SchedulingSubTab; label: string }[] = [
    { id: 'bookings', label: 'My Bookings' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6">
      {/* Sub-tab navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1 -mb-px" aria-label="Scheduling sections">
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  px-4 py-2.5 text-sm font-medium transition-all duration-200
                  border-b-2 whitespace-nowrap
                  ${isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
          <div className="w-8 h-8 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
          <span className="sr-only">Loading bookings…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 py-12 text-center" role="alert">
          Couldn't load bookings: {error}
        </p>
      ) : activeSubTab === 'bookings' ? (
        <MyBookings bookings={bookings} viewer={viewer} appointmentTypeNames={appointmentTypeNames} onActionComplete={reload} />
      ) : (
        <SchedulingAnalytics bookings={bookings} viewer={viewer} appointmentTypeNames={appointmentTypeNames} />
      )}
    </div>
  );
}
