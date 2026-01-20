/**
 * Tenant Context
 * Manages super admin tenant switching state
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TenantOption } from '../types/analytics';

interface TenantContextType {
  /** Currently selected tenant for viewing (null = use JWT tenant) */
  selectedTenant: TenantOption | null;
  /** Select a tenant to view */
  selectTenant: (tenant: TenantOption | null) => void;
  /** Get the tenant ID to use for API calls (override or null for JWT default) */
  getTenantOverride: () => string | null;
  /** Key that changes when tenant switches - use as React key to force remount */
  tenantKey: string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [tenantKey, setTenantKey] = useState<string>('default');

  const selectTenant = useCallback((tenant: TenantOption | null) => {
    setSelectedTenant(tenant);
    // Update key to force dashboard remount and refetch
    setTenantKey(tenant?.tenant_id || 'default');
  }, []);

  const getTenantOverride = useCallback(() => {
    return selectedTenant?.tenant_id || null;
  }, [selectedTenant]);

  return (
    <TenantContext.Provider value={{ selectedTenant, selectTenant, getTenantOverride, tenantKey }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
