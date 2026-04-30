/**
 * NotificationsDashboard — unit + integration tests
 * Covers: Phase 2a (Dashboard tab), Phase 2b (Recipients tab), Phase 2c (Templates tab)
 *
 * Test runner: Vitest + @testing-library/react
 *
 * To enable, add to package.json devDependencies:
 *   "vitest": "^2",
 *   "@testing-library/react": "^16",
 *   "@testing-library/user-event": "^14",
 *   "@testing-library/jest-dom": "^6",
 *   "jsdom": "^25"
 *
 * And add to vite.config.ts / vitest.config.ts:
 *   test: { environment: 'jsdom', setupFiles: ['./src/setupTests.ts'] }
 *
 * src/setupTests.ts:
 *   import '@testing-library/jest-dom'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before component import
// ---------------------------------------------------------------------------

vi.mock('../../services/analyticsApi', () => ({
  fetchNotificationSummary: vi.fn(),
  fetchNotificationEvents: vi.fn(),
  fetchNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
  sendTestNotification: vi.fn(),
  fetchNotificationTemplates: vi.fn(),
  updateNotificationTemplate: vi.fn(),
  previewTemplate: vi.fn(),
  sendTestTemplate: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { tenant_id: 'TEST001', tenant_hash: 'te1234', email: 'admin@test.com' } }),
}));

import { NotificationsDashboard } from '../NotificationsDashboard';
import {
  fetchNotificationSummary,
  fetchNotificationEvents,
  fetchNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  updateNotificationTemplate,
  previewTemplate,
  sendTestTemplate,
} from '../../services/analyticsApi';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const mockSummary = {
  sent: 1_200,
  delivered: 1_150,
  bounced: 30,
  complained: 5,
  opened: 690,
  clicked: 120,
  failed: 20,
  delivery_rate: 95.8,
  open_rate: 60.0,
  bounce_rate: 2.5,
  period: '7d',
};

const mockEventsResponse = {
  events: [
    {
      timestamp: new Date(Date.now() - 2 * 60_000).toISOString(), // 2m ago
      event_type: 'delivery' as const,
      channel: 'email',
      recipient: 'alice@example.com',
      form_id: 'apply_volunteer',
      status: 'delivery',
      message_id: 'msg_001',
    },
    {
      timestamp: new Date(Date.now() - 65 * 60_000).toISOString(), // 1h ago
      event_type: 'bounce' as const,
      channel: 'email',
      recipient: 'bob@example.com',
      form_id: 'apply_donor',
      status: 'bounce',
      message_id: 'msg_002',
    },
  ],
  total: 2,
  page: 1,
  has_more: false,
};

const mockNotificationSettings = {
  forms: {
    volunteer_apply: {
      form_title: 'Volunteer Application',
      notifications: {
        internal: {
          enabled: true,
          recipients: ['chris@myrecruiter.ai', 'coord@nonprofit.org'],
          subject: 'New volunteer: {first_name} {last_name}',
          body_template: 'Hi Team,\n\n{form_data}\n\nBest, MyRecruiter AI',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: {
          enabled: true,
          subject: 'Thanks for applying, {first_name}!',
          body_template: 'Hi {first_name},\nThank you!',
          use_tenant_branding: true,
        },
      },
    },
    contact_form: {
      form_title: 'Contact Form',
      notifications: {
        internal: {
          enabled: false,
          recipients: [],
          subject: 'New contact: {first_name}',
          body_template: '',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: {
          enabled: false,
          subject: '',
          body_template: '',
          use_tenant_branding: false,
        },
      },
    },
  },
};

const mockPreviewResponse = {
  subject: 'New volunteer: John Doe',
  body_html: '<html><body><p>Hi Team,</p><p>Sample data</p></body></html>',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDashboard() {
  const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
  const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
  mockedSummary.mockResolvedValue(mockSummary);
  mockedEvents.mockResolvedValue(mockEventsResponse);
  return { mockedSummary, mockedEvents };
}

function setupRecipients() {
  setupDashboard();
  const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
  const mockedUpdate = updateNotificationSettings as ReturnType<typeof vi.fn>;
  const mockedTestSend = sendTestNotification as ReturnType<typeof vi.fn>;
  mockedSettings.mockResolvedValue(mockNotificationSettings);
  mockedUpdate.mockResolvedValue({ success: true });
  mockedTestSend.mockResolvedValue({ success: true });
  return { mockedSettings, mockedUpdate, mockedTestSend };
}

function setupTemplates() {
  setupDashboard();
  const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
  const mockedUpdateTemplate = updateNotificationTemplate as ReturnType<typeof vi.fn>;
  const mockedPreview = previewTemplate as ReturnType<typeof vi.fn>;
  const mockedTestSend = sendTestTemplate as ReturnType<typeof vi.fn>;
  mockedSettings.mockResolvedValue(mockNotificationSettings);
  mockedUpdateTemplate.mockResolvedValue({ success: true });
  mockedPreview.mockResolvedValue(mockPreviewResponse);
  mockedTestSend.mockResolvedValue({ success: true });
  return { mockedTemplates: mockedSettings, mockedUpdateTemplate, mockedPreview, mockedTestSend };
}

async function navigateTo(tabName: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: tabName }));
  return user;
}

// ---------------------------------------------------------------------------
// Tests — Sub-tab navigation
// ---------------------------------------------------------------------------

describe('NotificationsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('sub-tab bar', () => {
    it('renders all three sub-tab buttons', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      expect(screen.getByRole('tab', { name: /Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Recipients/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Templates/i })).toBeInTheDocument();
    });

    it('shows the Dashboard sub-tab as selected by default', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      const dashTab = screen.getByRole('tab', { name: /Dashboard/i });
      expect(dashTab).toHaveAttribute('aria-selected', 'true');
    });

    it('activates Recipients tab on click and shows recipient content', async () => {
      setupRecipients();
      render(<NotificationsDashboard />);

      await navigateTo(/Recipients/i);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Recipients/i })).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('activates Templates tab on click and shows template content', async () => {
      setupTemplates();
      render(<NotificationsDashboard />);

      await navigateTo(/Templates/i);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Templates/i })).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('can navigate back to Dashboard tab', async () => {
      setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);

      await user.click(screen.getByRole('tab', { name: /Recipients/i }));
      await user.click(screen.getByRole('tab', { name: /Dashboard/i }));

      await waitFor(() => {
        expect(screen.getByText('SENT')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard sub-tab: stat cards
  // -------------------------------------------------------------------------

  describe('Dashboard sub-tab — stat cards', () => {
    it('calls fetchNotificationSummary on mount', async () => {
      const { mockedSummary } = setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(mockedSummary).toHaveBeenCalledTimes(1);
      });
    });

    it('renders four hero stat card labels', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('SENT')).toBeInTheDocument();
        expect(screen.getByText('DELIVERED')).toBeInTheDocument();
        expect(screen.getByText('BOUNCED')).toBeInTheDocument();
        expect(screen.getByText('OPENED')).toBeInTheDocument();
      });
    });

    it('displays correct stat values from API response', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1,200')).toBeInTheDocument(); // sent
        expect(screen.getByText('1,150')).toBeInTheDocument(); // delivered
        expect(screen.getByText('30')).toBeInTheDocument();    // bounced
        expect(screen.getByText('690')).toBeInTheDocument();   // opened
      });
    });

    it('shows delivery_rate in the DELIVERED card subtitle', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('95.8% delivery rate')).toBeInTheDocument();
      });
    });

    it('shows bounce_rate in the BOUNCED card subtitle', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2.5% bounce rate')).toBeInTheDocument();
      });
    });

    it('shows open_rate in the OPENED card subtitle', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('60% open rate')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard sub-tab: event log
  // -------------------------------------------------------------------------

  describe('Dashboard sub-tab — event log', () => {
    it('calls fetchNotificationEvents on mount', async () => {
      const { mockedEvents } = setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(mockedEvents).toHaveBeenCalledTimes(1);
      });
    });

    it('renders recipient email in table', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });
    });

    it('renders status badge for delivered event', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        const badges = screen.getAllByText('delivery');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('renders status badge for bounce event with red styling', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        const bounceBadge = screen.getByText('bounce');
        expect(bounceBadge).toHaveClass('bg-red-100');
        expect(bounceBadge).toHaveClass('text-red-700');
      });
    });

    it('renders form_id column', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('apply_volunteer')).toBeInTheDocument();
      });
    });

    it('renders relative timestamps', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2m ago')).toBeInTheDocument();
        expect(screen.getByText('1h ago')).toBeInTheDocument();
      });
    });

    it('shows empty state when no events returned', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue(mockSummary);
      mockedEvents.mockResolvedValue({ events: [], total: 0, page: 1, has_more: false });

      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/No notification data yet/i)).toBeInTheDocument();
        expect(screen.getByText(/Submit a form to see delivery tracking/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard sub-tab: filters
  // -------------------------------------------------------------------------

  describe('Dashboard sub-tab — channel and status filters', () => {
    it('renders Channel filter dropdown', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All Channels')).toBeInTheDocument();
      });
    });

    it('renders Status filter dropdown', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
      });
    });

    it('passes channel filter to fetchNotificationEvents', async () => {
      const { mockedEvents } = setupDashboard();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);

      await waitFor(() => screen.getByText('All Channels'));

      await user.click(screen.getByText('All Channels'));
      await user.click(screen.getByText('Email'));

      await waitFor(() => {
        const lastCall = mockedEvents.mock.calls[mockedEvents.mock.calls.length - 1][0];
        expect(lastCall.channel).toBe('email');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard sub-tab: error state
  // -------------------------------------------------------------------------

  describe('Dashboard sub-tab — error handling', () => {
    it('shows error message when API fails', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      mockedSummary.mockRejectedValue(new Error('API unavailable'));
      mockedEvents.mockRejectedValue(new Error('API unavailable'));

      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('API unavailable')).toBeInTheDocument();
      });
    });

    it('retry button calls loadData again', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;

      mockedSummary
        .mockRejectedValueOnce(new Error('API unavailable'))
        .mockResolvedValue(mockSummary);
      mockedEvents
        .mockRejectedValueOnce(new Error('API unavailable'))
        .mockResolvedValue(mockEventsResponse);

      const user = userEvent.setup();
      render(<NotificationsDashboard />);

      await waitFor(() => screen.getByText('API unavailable'));

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('SENT')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows skeleton cards while data loads', () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      expect(screen.getByLabelText(/Loading metrics/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility checks — shared
  // -------------------------------------------------------------------------

  describe('accessibility — shared', () => {
    it('sub-tab bar has role=tablist', () => {
      setupDashboard();
      const { container } = render(<NotificationsDashboard />);
      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeInTheDocument();
    });

    it('sub-tab bar has an accessible label', () => {
      setupDashboard();
      render(<NotificationsDashboard />);
      expect(screen.getByRole('tablist', { name: /Notifications sections/i })).toBeInTheDocument();
    });

    it('active tab has aria-selected=true and others have aria-selected=false', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      const dashTab = screen.getByRole('tab', { name: /Dashboard/i });
      const recipientsTab = screen.getByRole('tab', { name: /Recipients/i });
      const templatesTab = screen.getByRole('tab', { name: /Templates/i });

      expect(dashTab).toHaveAttribute('aria-selected', 'true');
      expect(recipientsTab).toHaveAttribute('aria-selected', 'false');
      expect(templatesTab).toHaveAttribute('aria-selected', 'false');
    });

    it('tabpanel has a label matching the current sub-tab', () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      const panel = screen.getByRole('tabpanel', { name: /dashboard/i });
      expect(panel).toBeInTheDocument();
    });

    it('event log section has an accessible heading', async () => {
      setupDashboard();
      render(<NotificationsDashboard />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Event Log/i })
        ).toBeInTheDocument();
      });
    });

    it('aria-busy is set on loading skeleton', () => {
      setupDashboard();
      render(<NotificationsDashboard />);
      const busyEl = screen.getByLabelText(/Loading metrics/i);
      expect(busyEl).toHaveAttribute('aria-busy', 'true');
    });

    it('stat card section loading skeleton is aria-busy=true', () => {
      setupDashboard();
      render(<NotificationsDashboard />);
      const busyNodes = document.querySelectorAll('[aria-busy="true"]');
      expect(busyNodes.length).toBeGreaterThan(0);
    });

    it('tabs are keyboard-activatable with Enter', async () => {
      setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);

      const recipientsTab = screen.getByRole('tab', { name: /Recipients/i });
      recipientsTab.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Recipients/i })).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Recipients tab — Phase 2b
  // -------------------------------------------------------------------------

  describe('Recipients tab', () => {
    async function openRecipientsTab() {
      setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));
      // Wait for async data load
      await waitFor(() => {
        expect(screen.getByText('Volunteer Application')).toBeInTheDocument();
      });
      return user;
    }

    it('calls fetchNotificationSettings when Recipients tab is opened', async () => {
      const { mockedSettings } = setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => {
        expect(mockedSettings).toHaveBeenCalledTimes(1);
      });
    });

    it('renders a card for each form in the settings response', async () => {
      await openRecipientsTab();

      expect(screen.getByText('Volunteer Application')).toBeInTheDocument();
      expect(screen.getByText('Contact Form')).toBeInTheDocument();
    });

    it('renders existing recipients as badge chips', async () => {
      await openRecipientsTab();

      expect(screen.getByText('chris@myrecruiter.ai')).toBeInTheDocument();
      expect(screen.getByText('coord@nonprofit.org')).toBeInTheDocument();
    });

    it('recipients list has role=list for assistive tech', async () => {
      await openRecipientsTab();

      // At least one recipient list must be present
      expect(screen.getAllByRole('list', { name: /Recipient email addresses/i }).length).toBeGreaterThan(0);
    });

    it('each recipient badge has an accessible remove button', async () => {
      await openRecipientsTab();

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      expect(removeBtn).toBeInTheDocument();
    });

    it('removes a recipient when the X button is clicked', async () => {
      const user = await openRecipientsTab();

      await user.click(screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i }));

      await waitFor(() => {
        expect(screen.queryByText('chris@myrecruiter.ai')).not.toBeInTheDocument();
      });
    });

    it('adds a new recipient via the Add button', async () => {
      const user = await openRecipientsTab();

      const emailInputs = screen.getAllByRole('textbox', { name: /New recipient email/i });
      await user.type(emailInputs[0], 'new@example.com');

      const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
      });
    });

    it('adds a recipient when Enter is pressed in the email input', async () => {
      const user = await openRecipientsTab();

      const emailInputs = screen.getAllByRole('textbox', { name: /New recipient email/i });
      await user.type(emailInputs[0], 'enter@example.com{Enter}');

      await waitFor(() => {
        expect(screen.getByText('enter@example.com')).toBeInTheDocument();
      });
    });

    it('shows a validation error for an invalid email', async () => {
      const user = await openRecipientsTab();

      const emailInputs = screen.getAllByRole('textbox', { name: /New recipient email/i });
      await user.type(emailInputs[0], 'not-an-email');

      const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('shows a duplicate email error', async () => {
      const user = await openRecipientsTab();

      const emailInputs = screen.getAllByRole('textbox', { name: /New recipient email/i });
      await user.type(emailInputs[0], 'chris@myrecruiter.ai');

      const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/already in the list/i)).toBeInTheDocument();
      });
    });

    it('email error input has aria-invalid=true', async () => {
      const user = await openRecipientsTab();

      const emailInputs = screen.getAllByRole('textbox', { name: /New recipient email/i });
      await user.type(emailInputs[0], 'bad-email');

      const addButtons = screen.getAllByRole('button', { name: /\+ Add/i });
      await user.click(addButtons[0]);

      await waitFor(() => {
        expect(emailInputs[0]).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('calls updateNotificationSettings when Save Changes is clicked', async () => {
      const { mockedUpdate } = setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      // Make a change to enable the Save button
      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      // Find and click Save Changes for the volunteer form
      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(mockedUpdate).toHaveBeenCalledWith('volunteer_apply', expect.any(Object));
      });
    });

    it('shows success message after successful save', async () => {
      const user = userEvent.setup();
      setupRecipients();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Settings saved successfully/i);
      });
    });

    it('shows error message when save fails', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      const mockedUpdate = updateNotificationSettings as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue(mockSummary);
      mockedEvents.mockResolvedValue(mockEventsResponse);
      mockedSettings.mockResolvedValue(mockNotificationSettings);
      mockedUpdate.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Network error/i);
      });
    });

    it('Save Changes button is disabled when form has no changes', async () => {
      await openRecipientsTab();

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      expect(saveButtons[0]).toBeDisabled();
    });

    it('Save Changes button becomes enabled after a change', async () => {
      const user = await openRecipientsTab();

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      expect(saveButtons[0]).not.toBeDisabled();
    });

    it('calls sendTestNotification with first recipient email', async () => {
      const { mockedTestSend } = setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const testButtons = screen.getAllByRole('button', { name: /Send Test Email/i });
      await user.click(testButtons[0]);

      await waitFor(() => {
        expect(mockedTestSend).toHaveBeenCalledWith('chris@myrecruiter.ai', 'volunteer_apply');
      });
    });

    it('shows success feedback after test email is sent', async () => {
      setupRecipients();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const testButtons = screen.getAllByRole('button', { name: /Send Test Email/i });
      await user.click(testButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Test email sent to chris@myrecruiter.ai/i);
      });
    });

    it('channel checkboxes toggle dirty state', async () => {
      const user = await openRecipientsTab();

      // Click the SMS checkbox for volunteer form
      const smsCheckboxes = screen.getAllByRole('checkbox', { name: /SMS/i });
      await user.click(smsCheckboxes[0]);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      expect(saveButtons[0]).not.toBeDisabled();
    });

    it('shows loading skeleton while settings load', () => {
      setupDashboard();
      // Use a promise that never resolves so the loading state stays visible
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      mockedSettings.mockImplementation(() => new Promise(() => {}));
      render(<NotificationsDashboard />);
      // Use synchronous fireEvent so the loading state is not drained before assertion
      fireEvent.click(screen.getByRole('tab', { name: /Recipients/i }));

      expect(screen.getByLabelText(/Loading recipient settings/i)).toBeInTheDocument();
    });

    it('shows retry button when settings fetch fails', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue(mockSummary);
      mockedEvents.mockResolvedValue(mockEventsResponse);
      mockedSettings.mockRejectedValue(new Error('fetch error'));

      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });

    it('internal notifications section heading is visible', async () => {
      await openRecipientsTab();

      const headings = screen.getAllByText(/Internal Notifications/i);
      expect(headings.length).toBeGreaterThan(0);
    });

    it('applicant confirmation section heading is visible', async () => {
      await openRecipientsTab();

      const headings = screen.getAllByText(/Applicant Confirmation/i);
      expect(headings.length).toBeGreaterThan(0);
    });

    it('internal toggle has proper label for screen readers', async () => {
      await openRecipientsTab();

      const toggleLabels = screen.getAllByText(/Enable internal notifications/i);
      expect(toggleLabels.length).toBeGreaterThan(0);
    });

    it('applicant toggle has proper label for screen readers', async () => {
      await openRecipientsTab();

      const toggleLabels = screen.getAllByText(/Enable applicant confirmation/i);
      expect(toggleLabels.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Templates tab — Phase 2c
  // -------------------------------------------------------------------------

  describe('Templates tab', () => {
    async function openTemplatesTab() {
      setupTemplates();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));
      // Wait for async data load — use getAllByText because the form title appears
      // in both the <option> element and the card heading
      await waitFor(() => {
        expect(screen.getAllByText('Volunteer Application').length).toBeGreaterThan(0);
      });
      return user;
    }

    it('calls fetchNotificationTemplates when Templates tab is opened', async () => {
      const { mockedTemplates } = setupTemplates();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => {
        expect(mockedTemplates).toHaveBeenCalledTimes(1);
      });
    });

    it('renders the form selector when multiple forms exist', async () => {
      await openTemplatesTab();

      expect(screen.getByRole('combobox', { name: /Select Form/i })).toBeInTheDocument();
    });

    it('form selector has an option for each form', async () => {
      await openTemplatesTab();

      const select = screen.getByRole('combobox', { name: /Select Form/i });
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('renders Internal Notification template section heading', async () => {
      await openTemplatesTab();

      expect(screen.getByText('Internal Notification')).toBeInTheDocument();
    });

    it('renders Applicant Confirmation template section heading', async () => {
      await openTemplatesTab();

      expect(screen.getByText('Applicant Confirmation')).toBeInTheDocument();
    });

    it('renders the internal subject input with existing value', async () => {
      await openTemplatesTab();

      const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
      expect(subjectInputs[0]).toHaveValue('New volunteer: {first_name} {last_name}');
    });

    it('renders the internal body textarea with existing value', async () => {
      await openTemplatesTab();

      const bodyTextareas = screen.getAllByRole('textbox', { name: /Body/i });
      expect(bodyTextareas[0]).toHaveValue('Hi Team,\n\n{form_data}\n\nBest, MyRecruiter AI');
    });

    it('renders available template variables for internal section', async () => {
      await openTemplatesTab();

      expect(screen.getAllByText('{first_name}').length).toBeGreaterThan(0);
      expect(screen.getAllByText('{form_data}').length).toBeGreaterThan(0);
    });

    it('variable hints are rendered as code elements', async () => {
      await openTemplatesTab();

      const codeEls = document.querySelectorAll('code');
      expect(codeEls.length).toBeGreaterThan(0);
    });

    it('editing subject marks the form dirty', async () => {
      const user = await openTemplatesTab();

      const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
      await user.clear(subjectInputs[0]);
      await user.type(subjectInputs[0], 'Updated subject');

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('Save button is disabled when no changes', async () => {
      await openTemplatesTab();

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      expect(saveButton).toBeDisabled();
    });

    it('calls updateNotificationTemplate with correct args on save', async () => {
      const { mockedUpdateTemplate } = setupTemplates();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => screen.getAllByText('Volunteer Application'));

      const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
      await user.type(subjectInputs[0], ' updated');

      await user.click(screen.getByRole('button', { name: /^Save$/i }));

      await waitFor(() => {
        expect(mockedUpdateTemplate).toHaveBeenCalledWith(
          'volunteer_apply',
          expect.any(Object)
        );
      });
    });

    it('shows success feedback after save', async () => {
      const user = await openTemplatesTab();

      const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
      await user.type(subjectInputs[0], ' updated');

      await user.click(screen.getByRole('button', { name: /^Save$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Templates saved successfully/i);
      });
    });

    it('shows error feedback when save fails', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      const mockedUpdateTemplate = updateNotificationTemplate as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue(mockSummary);
      mockedEvents.mockResolvedValue(mockEventsResponse);
      mockedSettings.mockResolvedValue(mockNotificationSettings);
      mockedUpdateTemplate.mockRejectedValue(new Error('Save failed'));

      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => screen.getAllByText('Volunteer Application'));

      const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
      await user.type(subjectInputs[0], ' test');

      await user.click(screen.getByRole('button', { name: /^Save$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Save failed/i);
      });
    });

    it('calls previewTemplate when Preview button is clicked', async () => {
      const { mockedPreview } = setupTemplates();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => screen.getAllByText('Volunteer Application'));

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => {
        expect(mockedPreview).toHaveBeenCalledWith('volunteer_apply', 'internal');
      });
    });

    it('opens preview modal with subject after Preview click', async () => {
      const user = await openTemplatesTab();

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('New volunteer: John Doe')).toBeInTheDocument();
      });
    });

    it('preview modal can be closed with the X button', async () => {
      const user = await openTemplatesTab();

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => screen.getByRole('dialog'));

      await user.click(screen.getByRole('button', { name: /Close preview/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('preview modal can be closed by pressing Escape', async () => {
      const user = await openTemplatesTab();

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => screen.getByRole('dialog'));

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('preview modal has aria-modal=true', async () => {
      const user = await openTemplatesTab();

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
      });
    });

    it('preview modal has an accessible label via aria-labelledby', async () => {
      const user = await openTemplatesTab();

      const previewButtons = screen.getAllByRole('button', { name: /^Preview$/i });
      await user.click(previewButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'preview-modal-title');
      });
    });

    it('calls sendTestTemplate when Send Test is clicked', async () => {
      const { mockedTestSend } = setupTemplates();
      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => screen.getAllByText('Volunteer Application'));

      await user.click(screen.getByRole('button', { name: /Send Test/i }));

      await waitFor(() => {
        expect(mockedTestSend).toHaveBeenCalledWith('volunteer_apply');
      });
    });

    it('shows success feedback after test send', async () => {
      const user = await openTemplatesTab();

      await user.click(screen.getByRole('button', { name: /Send Test/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Test email sent to your account email/i);
      });
    });

    it('changing form selector updates displayed templates', async () => {
      const user = await openTemplatesTab();

      const select = screen.getByRole('combobox', { name: /Select Form/i });
      await user.selectOptions(select, 'contact_form');

      await waitFor(() => {
        // Contact form subject is empty — subject input value changes
        const subjectInputs = screen.getAllByRole('textbox', { name: /Subject/i });
        expect(subjectInputs[0]).toHaveValue('New contact: {first_name}');
      });
    });

    it('shows loading skeleton while templates load', () => {
      setupDashboard();
      // Use a promise that never resolves so the loading state stays visible
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      mockedSettings.mockImplementation(() => new Promise(() => {}));
      render(<NotificationsDashboard />);
      // Use synchronous fireEvent so the loading state is not drained before assertion
      fireEvent.click(screen.getByRole('tab', { name: /Templates/i }));

      expect(screen.getByLabelText(/Loading templates/i)).toBeInTheDocument();
    });

    it('shows retry button when template fetch fails', async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      const mockedSettings = fetchNotificationSettings as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue(mockSummary);
      mockedEvents.mockResolvedValue(mockEventsResponse);
      mockedSettings.mockRejectedValue(new Error('load error'));

      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Templates/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // InlineMessage dismiss
  // -------------------------------------------------------------------------

  describe('InlineMessage component', () => {
    it('success message can be dismissed', async () => {
      const { mockedUpdate } = setupRecipients();
      mockedUpdate.mockResolvedValue({ success: true });

      const user = userEvent.setup();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      await user.click(saveButtons[0]);

      await waitFor(() => screen.getByRole('alert'));

      await user.click(screen.getByRole('button', { name: /Dismiss message/i }));

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('inline message has role=alert for screen readers', async () => {
      const user = userEvent.setup();
      setupRecipients();
      render(<NotificationsDashboard />);
      await user.click(screen.getByRole('tab', { name: /Recipients/i }));

      await waitFor(() => screen.getByText('Volunteer Application'));

      const removeBtn = screen.getByRole('button', { name: /Remove chris@myrecruiter.ai/i });
      await user.click(removeBtn);

      const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
      await user.click(saveButtons[0]);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// StatusBadge — standalone unit tests
// ---------------------------------------------------------------------------

describe('StatusBadge color mapping', () => {
  afterEach(() => {
    cleanup();
  });

  const cases: Array<{ status: string; expectedBg: string; expectedText: string }> = [
    { status: 'delivery', expectedBg: 'bg-emerald-100', expectedText: 'text-emerald-700' },
    { status: 'bounce', expectedBg: 'bg-red-100', expectedText: 'text-red-700' },
    { status: 'complaint', expectedBg: 'bg-orange-100', expectedText: 'text-orange-700' },
    { status: 'open', expectedBg: 'bg-purple-100', expectedText: 'text-purple-700' },
    { status: 'click', expectedBg: 'bg-indigo-100', expectedText: 'text-indigo-700' },
    { status: 'send', expectedBg: 'bg-blue-100', expectedText: 'text-blue-700' },
    { status: 'sent', expectedBg: 'bg-blue-100', expectedText: 'text-blue-700' },
    { status: 'failed', expectedBg: 'bg-red-100', expectedText: 'text-red-700' },
    { status: 'unknown_xyz', expectedBg: 'bg-slate-100', expectedText: 'text-slate-700' },
  ];

  cases.forEach(({ status, expectedBg, expectedText }) => {
    it(`renders ${status} badge with correct colors`, async () => {
      const mockedSummary = fetchNotificationSummary as ReturnType<typeof vi.fn>;
      const mockedEvents = fetchNotificationEvents as ReturnType<typeof vi.fn>;
      mockedSummary.mockResolvedValue({
        sent: 1, delivered: 1, bounced: 0, complained: 0,
        opened: 0, clicked: 0, failed: 0,
        delivery_rate: 100, open_rate: 0, bounce_rate: 0, period: '7d',
      });
      mockedEvents.mockResolvedValue({
        events: [
          {
            timestamp: new Date().toISOString(),
            event_type: 'send' as const,
            channel: 'email',
            recipient: 'test@test.com',
            form_id: 'form_x',
            status,
            message_id: 'msg_x',
          },
        ],
        total: 1,
        page: 1,
        has_more: false,
      });

      render(<NotificationsDashboard />);

      await waitFor(() => {
        const badge = screen.getByText(status);
        expect(badge).toHaveClass(expectedBg);
        expect(badge).toHaveClass(expectedText);
      });
    });
  });
});
