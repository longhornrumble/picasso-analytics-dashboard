/**
 * Settings Page
 * Phase 2 — Container for Notifications, Team, Profile sub-tabs
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationsDashboard } from './NotificationsDashboard';
import type { DashboardFeatures } from '../types/analytics';

type SettingsSubTab = 'notifications' | 'team' | 'profile';

const DEFAULT_FEATURES: DashboardFeatures = {
  dashboard_conversations: true,
  dashboard_forms: true,
  dashboard_attribution: false,
  dashboard_notifications: false,
  dashboard_settings: false,
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
        <ComingSoonPlaceholder
          title="Team Management"
          description="Invite team members, manage roles, and control access to your organization's portal."
          icon={
            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      )}

      {activeSubTab === 'profile' && (
        <ComingSoonPlaceholder
          title="Profile Settings"
          description="Manage your personal information, notification preferences, and account settings."
          icon={
            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
      )}
    </div>
  );
}

function ComingSoonPlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4">{icon}</div>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 max-w-md">{description}</p>
      <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-600">
        Coming Soon
      </span>
    </div>
  );
}
