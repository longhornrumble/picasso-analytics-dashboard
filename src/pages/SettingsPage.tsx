/**
 * Settings Page
 * Container for Notifications, Team, Profile sub-tabs
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationsDashboard } from './NotificationsDashboard';
import { TeamManagement } from './TeamManagement';
import { ProfileSettings } from './ProfileSettings';
import type { DashboardFeatures } from '../types/analytics';

type SettingsSubTab = 'notifications' | 'team' | 'profile';

const DEFAULT_FEATURES: DashboardFeatures = {
  dashboard_conversations: true,
  dashboard_forms: true,
  dashboard_attribution: false,
  dashboard_notifications: false,
  dashboard_settings: true,
};

export function SettingsPage() {
  const { user } = useAuth();
  const features = user?.features || DEFAULT_FEATURES;
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(
    features.dashboard_notifications ? 'notifications' : 'team'
  );

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
      id: 'profile',
      label: 'Profile',
      available: true,
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

      {activeSubTab === 'profile' && (
        <ProfileSettings />
      )}
    </div>
  );
}
