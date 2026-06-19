/**
 * NotificationsDashboard — former-recipient name resolution (recipients_directory).
 *
 * Self-contained mock surface (does NOT touch the main suite's shared mocks) so it can
 * exercise the member-checklist path, which needs fetchAdminTenantEmployees populated.
 *
 * Pins: a recipient_employee_id that is a *deactivated* employee renders by NAME + a
 * "Former" badge (resolved via recipients_directory), while an id with no registry record
 * still falls back to the raw UUID row.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/analyticsApi', () => ({
  fetchNotificationEvents: vi.fn().mockResolvedValue({ events: [], total: 0, page: 1, has_more: false }),
  fetchNotificationSummary: vi.fn().mockResolvedValue({}),
  fetchNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
  sendTestNotification: vi.fn().mockResolvedValue({ success: true }),
  updateNotificationTemplate: vi.fn().mockResolvedValue({ success: true }),
  previewTemplate: vi.fn().mockResolvedValue({ subject: '', body_html: '' }),
  sendTestTemplate: vi.fn().mockResolvedValue({ success: true }),
  fetchNotificationEventDetail: vi.fn().mockResolvedValue({}),
  fetchTeamMembers: vi.fn().mockResolvedValue({ members: [] }),
  fetchAdminTenantEmployees: vi.fn(),
  getTenantOverride: vi.fn().mockReturnValue(null),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { tenant_id: 'TEST001', tenant_hash: 'te1234', email: 'admin@test.com', role: 'admin' } }),
}));
vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { tenant_id: 'TEST001', tenant_hash: 'te1234', email: 'admin@test.com', role: 'admin' } }),
}));
vi.mock('../NotificationPreferences', () => ({
  NotificationPreferences: () => <div>prefs</div>,
}));

import { NotificationsDashboard } from '../NotificationsDashboard';
import { fetchNotificationSettings, fetchAdminTenantEmployees } from '../../services/analyticsApi';

const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
const mockedEmployees = fetchAdminTenantEmployees as ReturnType<typeof vi.fn>;

const SETTINGS = {
  forms: {
    form_contact: {
      form_title: 'Contact Form',
      notifications: {
        internal: {
          enabled: true,
          recipients: [],
          recipient_employee_ids: ['active-1', 'former-2', 'ghost-3'],
          subject: '',
          body_template: '',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: { enabled: false, subject: '', body_template: '', use_tenant_branding: true },
      },
    },
  },
  sms_provisioned: false,
  recipients_directory: {
    'former-2': { name: 'Former Fred', email: 'fred@x.com', status: 'inactive' },
  },
};

const EMPLOYEES = [
  {
    tenantId: 'TEST001', employeeId: 'active-1', email: 'annie@x.com', name: 'Active Annie',
    role: 'admin', type: 'clerk_user', status: 'active', createdAt: '', updatedAt: '',
    notificationPrefs: { email: true, sms: false },
  },
];

describe('NotificationsDashboard — former recipient resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockResolvedValue(SETTINGS);
    mockedEmployees.mockResolvedValue(EMPLOYEES);
  });

  it('shows a deactivated recipient by name + Former badge; unknown id stays a UUID', async () => {
    const user = userEvent.setup();
    render(<NotificationsDashboard />);
    await user.click(screen.getByRole('tab', { name: /Recipients/i }));

    // Active member resolves in the picker.
    expect(await screen.findByText('Active Annie')).toBeInTheDocument();
    // Inactive (former) employee shows by NAME with a "Former" badge — not a bare UUID.
    expect(screen.getByText('Former Fred')).toBeInTheDocument();
    expect(screen.getByText('Former')).toBeInTheDocument();
    expect(screen.queryByText('former-2')).not.toBeInTheDocument();
    // Truly-erased id (no directory entry) keeps the raw-id fallback row.
    expect(screen.getByText('ghost-3')).toBeInTheDocument();
  });
});
