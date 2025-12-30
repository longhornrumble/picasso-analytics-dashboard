/**
 * Picasso Analytics Dashboard
 * Premium Emerald Design System
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { ConversationsDashboard } from './pages/ConversationsDashboard';
import { Login } from './pages/Login';
import { PremiumLock } from './components/PremiumLock';
import type { DashboardFeatures } from './types/analytics';

type DashboardTab = 'conversations' | 'forms' | 'attribution';

// Lock icon for premium features
const LockIcon = () => (
  <svg className="w-3.5 h-3.5 ml-1.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// MyRecruiter Logo Component
const MyRecruiterLogo = () => (
  <div className="flex items-center group">
    <img
      src="/myrecruiter-logo.png"
      alt="MyRecruiter"
      className="h-10 w-auto transition-all duration-300 group-hover:scale-105"
    />
  </div>
);

// Default features - secure defaults when API unavailable
const DEFAULT_FEATURES: DashboardFeatures = {
  dashboard_conversations: true,
  dashboard_forms: true, // Unlocked for demo
  dashboard_attribution: false,
};

/**
 * Premium Navigation Bar - Liquid Header Design
 */
function NavigationBar({
  activeTab,
  onTabChange,
  onLockedTabClick,
  features = DEFAULT_FEATURES,
  onSignOut,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLockedTabClick: (tab: DashboardTab) => void;
  features?: DashboardFeatures;
  onSignOut: () => void;
}) {
  const tabs: { id: DashboardTab; label: string; icon: React.ReactNode; locked: boolean }[] = [
    {
      id: 'conversations',
      label: 'CONVERSATIONS',
      locked: !features.dashboard_conversations,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'forms',
      label: 'FORMS',
      locked: !features.dashboard_forms,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'attribution',
      label: 'ATTRIBUTION',
      locked: !features.dashboard_attribution,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-100"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <MyRecruiterLogo />

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isLocked = tab.locked;

              return (
                <button
                  key={tab.id}
                  onClick={() => isLocked ? onLockedTabClick(tab.id) : onTabChange(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider
                    transition-all duration-200 rounded-lg
                    ${isLocked
                      ? 'text-slate-300 cursor-not-allowed'
                      : isActive
                        ? 'text-primary-500 bg-primary-50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                  {isLocked && <LockIcon />}

                  {/* Precision Indicator - emerald underline */}
                  {isActive && !isLocked && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary-500" style={{ bottom: '-8px' }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right side - Sign Out */}
          <div className="flex items-center">
            <button
              onClick={onSignOut}
              className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: '#1e293b' }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Check if Bubble SSO is configured
const BUBBLE_AUTH_URL = import.meta.env.VITE_BUBBLE_AUTH_URL || '';

function AppContent() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('conversations');
  const [lockedTab, setLockedTab] = useState<DashboardTab | null>(null);

  const features = user?.features || DEFAULT_FEATURES;

  // Show loading state while checking auth OR while redirecting to Bubble
  if (loading || (!isAuthenticated && BUBBLE_AUTH_URL)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4 border-4 border-primary-200 border-t-primary-500"
          />
          <p className="text-slate-500 font-medium">
            {loading ? 'Loading...' : 'Redirecting to login...'}
          </p>
        </div>
      </div>
    );
  }

  // Show login only if not authenticated AND no Bubble URL (dev mode)
  if (!isAuthenticated) {
    return <Login />;
  }

  const handleLockedTabClick = (tab: DashboardTab) => {
    setLockedTab(tab);
  };

  const handleReturnToDashboard = () => {
    setLockedTab(null);
  };

  const renderDashboardContent = () => {
    if (lockedTab) {
      return (
        <PremiumLock
          feature={lockedTab}
          onReturn={handleReturnToDashboard}
        />
      );
    }

    switch (activeTab) {
      case 'forms':
        return <Dashboard />;
      case 'conversations':
        return <ConversationsDashboard />;
      case 'attribution':
        return (
          <PremiumLock
            feature="attribution"
            onReturn={() => setActiveTab('conversations')}
          />
        );
      default:
        return <ConversationsDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationBar
        activeTab={lockedTab || activeTab}
        onTabChange={(tab) => {
          setLockedTab(null);
          setActiveTab(tab);
        }}
        onLockedTabClick={handleLockedTabClick}
        features={features}
        onSignOut={logout}
      />
      <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderDashboardContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
