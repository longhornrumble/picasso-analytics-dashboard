/**
 * Picasso Analytics Dashboard
 * Premium Emerald Design System
 */

import React, { useState, useEffect, useRef } from 'react';
import { Show, SignIn, UserButton, useAuth as useClerkAuth } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { ConversationsDashboard } from './pages/ConversationsDashboard';
import { SettingsPage } from './pages/SettingsPage';
import { PremiumLock } from './components/PremiumLock';
import { fetchTenantList, setTenantOverride } from './services/analyticsApi';
import type { DashboardFeatures, User, TenantOption } from './types/analytics';

// Reuse the same base URL as analyticsApi.ts — avoids duplicating the default.
const AUTH_API_BASE_URL =
  import.meta.env.VITE_ANALYTICS_API_URL ||
  'https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws';

type DashboardTab = 'conversations' | 'forms' | 'attribution' | 'settings';

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
  dashboard_forms: false,
  dashboard_attribution: false,
  dashboard_notifications: false,
  dashboard_settings: true,
};

/**
 * Premium Navigation Bar - Liquid Header Design
 * Responsive: Mobile menu for screens < 768px (md breakpoint)
 */
function NavigationBar({
  activeTab,
  onTabChange,
  onLockedTabClick,
  features = DEFAULT_FEATURES,
  user,
  tenantList = [],
  selectedTenantId,
  onTenantChange,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLockedTabClick: (tab: DashboardTab) => void;
  features?: DashboardFeatures;
  user: User | null;
  tenantList?: TenantOption[];
  selectedTenantId?: string;
  onTenantChange?: (tenantId: string) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  // Check if user is super admin
  const isSuperAdmin = user?.role === 'super_admin';

  // Get current tenant name for display
  const currentTenant = tenantList.find(t => t.tenant_id === (selectedTenantId || user?.tenant_id));
  const currentTenantName = currentTenant?.name || selectedTenantId || user?.tenant_id || 'Select Tenant';

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
    {
      id: 'settings',
      label: 'SETTINGS',
      locked: false, // Settings is always accessible (Team + Profile are universal)
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.locked) {
      onLockedTabClick(tab.id);
    } else {
      onTabChange(tab.id);
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
    <header
      className="sticky top-0 z-50 border-b border-slate-100"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <MyRecruiterLogo />

          {/* Desktop Navigation Tabs - hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isLocked = tab.locked;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider
                    transition-all duration-200 rounded-full
                    ${isLocked
                      ? 'text-slate-300 cursor-not-allowed'
                      : isActive
                        ? 'text-primary-600 bg-primary-50'
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

          {/* Right side - User Info + Sign Out + Mobile Menu Button */}
          <div className="flex items-center gap-3">
            {/* Super Admin Tenant Selector - Desktop only */}
            {isSuperAdmin && tenantList.length > 0 && (
              <div className="hidden md:block relative">
                <button
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="max-w-32 truncate">{currentTenantName}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${tenantDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {tenantDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setTenantDropdownOpen(false)}
                    />
                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-2 max-h-80 overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Switch Tenant
                      </div>
                      {tenantList.map((tenant) => (
                        <button
                          key={tenant.tenant_id}
                          onClick={() => {
                            onTenantChange?.(tenant.tenant_id);
                            setTenantDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                            (selectedTenantId || user?.tenant_id) === tenant.tenant_id
                              ? 'text-primary-600 bg-primary-50'
                              : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{tenant.name}</div>
                            <div className="text-xs text-slate-400">{tenant.tenant_id}</div>
                          </div>
                          {(selectedTenantId || user?.tenant_id) === tenant.tenant_id && (
                            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Clerk avatar + user info */}
            <div className="hidden md:flex items-center gap-2">
              <div className="[&_.cl-avatarBox]:w-[35px] [&_.cl-avatarBox]:h-[35px] [&_.cl-userButtonTrigger]:p-0 flex items-center">
                <UserButton />
              </div>
              {user && (
                <div className="flex flex-col justify-center leading-tight">
                  <div className="text-sm font-medium text-slate-700 leading-snug">
                    {user.name || user.email || 'User'}
                  </div>
                  {user.company && (
                    <div className="text-xs text-slate-500 leading-snug">
                      {user.company}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Button - visible on mobile only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

    </header>

      {/* Mobile Menu Overlay - Rendered outside header for proper z-index stacking */}
      {/* Backdrop - fixed overlay below header */}
      <div
        className={`
          md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm
          transition-opacity duration-300
          ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        style={{ top: '64px' }}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Menu Panel */}
      <div
        className={`
          md:hidden fixed left-0 right-0 z-50 bg-white shadow-2xl
          transition-all duration-300 ease-out
          ${mobileMenuOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
          }
        `}
        style={{ top: '64px' }}
      >
        <nav className="px-3 py-3 space-y-2 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isLocked = tab.locked;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold tracking-wider
                  transition-all duration-200 rounded-xl
                  ${isLocked
                    ? 'text-slate-300 cursor-not-allowed'
                    : isActive
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
                {isLocked && <LockIcon />}
              </button>
            );
          })}

          {/* Mobile User Info + Tenant Selector */}
          <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
            {/* Mobile User Info — Clerk avatar + name/org */}
            <div className="flex items-center gap-3 px-4 py-2">
              <UserButton />
              {user && (
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {user.name || user.email || 'User'}
                  </div>
                  {user.company && (
                    <div className="text-xs text-slate-500">
                      {user.company}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Tenant Selector - Super Admin only */}
            {isSuperAdmin && tenantList.length > 0 && (
              <div className="px-4">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Switch Tenant
                </label>
                <select
                  value={selectedTenantId || user?.tenant_id || ''}
                  onChange={(e) => {
                    onTenantChange?.(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border-0 focus:ring-2 focus:ring-primary-500"
                >
                  {tenantList.map((tenant) => (
                    <option key={tenant.tenant_id} value={tenant.tenant_id}>
                      {tenant.name} ({tenant.tenant_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </nav>
      </div>
    </>
  );
}

// Bubble SSO URL removed — replaced by Clerk auth

function AppContent() {
  const { isAuthenticated, loading, user, logout, login } = useAuth();
  const { isSignedIn, getToken: getClerkToken } = useClerkAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('conversations');
  const [lockedTab, setLockedTab] = useState<DashboardTab | null>(null);

  // Track whether the bridge is in-flight to prevent duplicate calls.
  const bridgingRef = useRef(false);
  // Track bridge error for display.
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  /**
   * Clerk-to-internal-JWT bridge.
   * Fires when Clerk is signed in but we don't yet have an internal Picasso JWT.
   * POSTs the Clerk session token to /auth/clerk. The backend resolves the
   * user's org membership via Clerk API and issues a Picasso JWT.
   */
  useEffect(() => {
    if (!isSignedIn || isAuthenticated || bridgingRef.current) return;

    bridgingRef.current = true;
    setBridgeError(null);

    (async () => {
      try {
        const clerkToken = await getClerkToken();
        if (!clerkToken) throw new Error('Could not obtain Clerk session token');

        const resp = await fetch(`${AUTH_API_BASE_URL}/auth/clerk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clerk_token: clerkToken }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || `Auth bridge returned ${resp.status}`);
        }

        if (!data.token) throw new Error('Backend did not return a token');

        login(data.token);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown auth error';
        console.error('[clerk-bridge] Auth bridge failed:', message);
        setBridgeError(message);
        bridgingRef.current = false; // allow retry on next render
      }
    })();
  }, [isSignedIn, isAuthenticated, getClerkToken, login]);

  // When Clerk signs out, clear the internal JWT too
  useEffect(() => {
    if (!isSignedIn && isAuthenticated) {
      logout();
      bridgingRef.current = false;
    }
  }, [isSignedIn, isAuthenticated, logout]);

  // Cross-tab navigation: search query to pass to Forms dashboard
  const [formsSearchQuery, setFormsSearchQuery] = useState<string | null>(null);

  // Super admin tenant switching
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenantList, setTenantList] = useState<TenantOption[]>([]);
  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch tenant list for super_admin users
  useEffect(() => {
    if (isSuperAdmin && isAuthenticated) {
      fetchTenantList()
        .then(setTenantList)
        .catch((err) => console.warn('Failed to fetch tenant list:', err));
    }
  }, [isSuperAdmin, isAuthenticated]);

  // Handle tenant change - sets API override and triggers refetch via key change
  const handleTenantChange = (tenantId: string) => {
    const isOwnTenant = tenantId === user?.tenant_id;
    if (isOwnTenant) {
      setTenantOverride(null);
      setSelectedTenantId(null);
    } else {
      setTenantOverride(tenantId);
      setSelectedTenantId(tenantId);
    }
  };

  const features = user?.features || DEFAULT_FEATURES;

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4 border-4 border-primary-200 border-t-primary-500"
          />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Clerk login gate — show sign-in when Clerk session is absent.
  // When Clerk is signed in but internal JWT is not yet established, the
  // bridge useEffect above is running; show a spinner instead of <Login />.
  if (!isAuthenticated) {
    return (
      <>
        {/* Clerk signed-out: full-page sign-in */}
        <Show when="signed-out">
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <SignIn routing="hash" />
          </div>
        </Show>

        {/* Clerk signed-in but internal JWT not yet issued: show bridge spinner or error */}
        <Show when="signed-in">
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              {bridgeError ? (
                <>
                  <p className="text-red-500 font-medium text-sm max-w-xs">
                    Sign-in failed: {bridgeError}
                  </p>
                  <p className="text-slate-400 text-xs">
                    Contact support if this persists.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full animate-spin mx-auto border-4 border-primary-200 border-t-primary-500" />
                  <p className="text-slate-500 text-sm font-medium">Signing you in...</p>
                </>
              )}
            </div>
          </div>
        </Show>
      </>
    );
  }

  const handleLockedTabClick = (tab: DashboardTab) => {
    setLockedTab(tab);
  };

  const handleReturnToDashboard = () => {
    setLockedTab(null);
  };

  // Handle navigation from Conversations to Forms dashboard
  const handleViewFormSubmission = (sessionId: string, _formId: string) => {
    // Set search query to session ID to find the related form submission
    setFormsSearchQuery(sessionId);
    // Switch to Forms tab
    setActiveTab('forms');
    setLockedTab(null);
  };

  // Clear the search query after it's been consumed by Dashboard
  const handleFormsSearchApplied = () => {
    setFormsSearchQuery(null);
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
        return (
          <Dashboard
            initialSearchQuery={formsSearchQuery}
            onSearchApplied={handleFormsSearchApplied}
          />
        );
      case 'conversations':
        return (
          <ConversationsDashboard
            onViewFormSubmission={handleViewFormSubmission}
          />
        );
      case 'attribution':
        return (
          <PremiumLock
            feature="attribution"
            onReturn={() => setActiveTab('conversations')}
          />
        );
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <ConversationsDashboard
            onViewFormSubmission={handleViewFormSubmission}
          />
        );
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
        user={user}
        tenantList={tenantList}
        selectedTenantId={selectedTenantId || undefined}
        onTenantChange={handleTenantChange}
      />
      <main
        key={selectedTenantId || 'default'}
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
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
