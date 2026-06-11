/**
 * Settings Page
 * Container for Notifications and Team sub-tabs
 * Profile management handled by Clerk's UserButton modal
 */

import { useState, useRef } from 'react';
import { useAuth } from '../context/useAuth';
import { NotificationsDashboard } from './NotificationsDashboard';
import { TeamManagement } from './TeamManagement';
import { NotificationPreferences } from './NotificationPreferences';
import { SchedulingSetup } from './scheduling/SchedulingSetup';
import AdminPanel from './AdminPanel';
import { CalendarConnection } from '../components/scheduling/CalendarConnection';
import type { DashboardFeatures } from '../types/analytics';

type SettingsSubTab = 'notifications' | 'team' | 'preferences' | 'scheduling' | 'calendar' | 'admin';

const DEFAULT_FEATURES: DashboardFeatures = {
  dashboard_conversations: true,
  dashboard_forms: false,
  dashboard_attribution: false,
  dashboard_notifications: false,
  dashboard_settings: true,
  dashboard_scheduling: false,
};

export function SettingsPage() {
  const { user } = useAuth();
  const features = user?.features || DEFAULT_FEATURES;
  // Support direct-link to the Calendar sub-tab from the E13 "Connect calendar" CTA
  // (staffStatus warning appends ?settings_tab=calendar when routing here).
  // NOTE: This SPA has no router — query-param full-load IS its deep-link mechanism.
  // `settings_tab` is consumed once on mount; we immediately strip it with replaceState
  // so it doesn't persist across subsequent tab changes (mirrors CalendarConnection's
  // ?calendar=connected stripping).
  const initialTab = ((): SettingsSubTab => {
    const p = new URLSearchParams(window.location.search);
    // Only resolve to calendar tab when the feature is entitled; un-entitled users
    // fall through to the default tab (no blank pane).
    if (p.get('settings_tab') === 'calendar' && features.dashboard_scheduling) return 'calendar';
    return features.dashboard_notifications ? 'notifications' : 'team';
  })();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(initialTab);

  // Strip the consumed `settings_tab` param so it doesn't survive tab switches.
  // Called once after the initial render — cannot be in the initialTab IIFE because
  // replaceState is a side effect (not safe in a pure initializer).
  const settingsTabStripped = useRef(false);
  if (!settingsTabStripped.current) {
    settingsTabStripped.current = true;
    const p = new URLSearchParams(window.location.search);
    if (p.has('settings_tab')) {
      p.delete('settings_tab');
      const newSearch = p.toString();
      const newUrl = newSearch
        ? `${window.location.pathname}?${newSearch}${window.location.hash}`
        : `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);
    }
  }

  const subTabs: { id: SettingsSubTab; label: string; available: boolean }[] = [
    {
      id: 'notifications',
      label: 'Notifications',
      available: features.dashboard_notifications,
    },
    {
      id: 'team',
      label: 'Team',
      available: true,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      available: true,
    },
    {
      id: 'scheduling',
      label: 'Scheduling',
      // Entitled tenants only (D1 Flag A). Visible to ALL entitled users: admins get the
      // Teams/Appointment-Types config + staff roster; members get only their own calendar-
      // email self-edit (E13c §8 matrix). Per-field auth is server-enforced regardless.
      available: features.dashboard_scheduling,
    },
    {
      id: 'calendar' as SettingsSubTab,
      label: 'Calendar',
      // Track 2 Surface 1: per-staff calendar connection (OAuth). Gated on the same
      // dashboard_scheduling flag — only entitled tenants see this tab.
      available: features.dashboard_scheduling,
    },
    {
      id: 'admin' as SettingsSubTab,
      label: 'Admin',
      available: user?.role === 'super_admin',
    },
  ];

  const availableTabs = subTabs.filter(t => t.available);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6">
      {/* Sub-tab navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1 -mb-px">
          {availableTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
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

      {/* Sub-tab content */}
      {activeSubTab === 'notifications' && features.dashboard_notifications && (
        <NotificationsDashboard />
      )}

      {activeSubTab === 'team' && (
        <TeamManagement />
      )}

      {activeSubTab === 'preferences' && (
        <NotificationPreferences />
      )}

      {activeSubTab === 'scheduling' && features.dashboard_scheduling && (
        <SchedulingSetup />
      )}

      {activeSubTab === 'calendar' && features.dashboard_scheduling && (
        <CalendarConnection />
      )}

      {activeSubTab === 'admin' && user?.role === 'super_admin' && (
        <AdminPanel />
      )}
    </div>
  );
}
