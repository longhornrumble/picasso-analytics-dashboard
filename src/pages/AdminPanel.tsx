/**
 * AdminPanel — top-level container for Super Admin sections.
 * Currently exposes Tenant Management (Round 1).
 * Employee Management is planned for Round 2 and rendered disabled.
 */

import React, { useState } from 'react';
import TenantManagement from './admin/TenantManagement';

type AdminSection = 'tenants' | 'employees';

export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<AdminSection>('tenants');

  return (
    <div>
      {/* Section toggle */}
      <div className="flex gap-2 mb-6" role="tablist" aria-label="Admin sections">
        <button
          role="tab"
          aria-selected={activeSection === 'tenants'}
          aria-controls="admin-panel-content"
          onClick={() => setActiveSection('tenants')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'tenants'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tenant Management
        </button>
        <button
          role="tab"
          aria-selected={activeSection === 'employees'}
          aria-controls="admin-panel-content"
          onClick={() => setActiveSection('employees')}
          disabled
          title="Coming in Round 2"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'employees'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100'
          } opacity-40 cursor-not-allowed`}
        >
          Employee Management
        </button>
      </div>

      {/* Content */}
      <div id="admin-panel-content" role="tabpanel">
        {activeSection === 'tenants' && <TenantManagement />}
      </div>
    </div>
  );
}
