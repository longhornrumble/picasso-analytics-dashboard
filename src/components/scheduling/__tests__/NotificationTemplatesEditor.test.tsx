import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = {
  fetchNotificationTemplates: vi.fn(),
  updateNotificationTemplate: vi.fn(),
};
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual,
    fetchNotificationTemplates: () => api.fetchNotificationTemplates(),
    updateNotificationTemplate: (...a: unknown[]) => api.updateNotificationTemplate(...a),
  };
});

import { NotificationTemplatesEditor } from '../NotificationTemplatesEditor';

const tpl = (over: Partial<{ subject: string; is_override: boolean; sms_is_override: boolean }> = {}) => ({
  subject: over.subject ?? 'Default subject',
  body_text: 'Hi {{firstName}}',
  body_html: '<p>Hi {{firstName}}</p>',
  is_override: over.is_override ?? false,
  default: { subject: 'Default subject', body_text: 'Hi {{firstName}}', body_html: '<p>Hi {{firstName}}</p>' },
  available_variables: ['{{firstName}}', '{{actionUrl}}'],
  sms_text: 'Default SMS {{firstName}}',
  sms_is_override: over.sms_is_override ?? false,
  sms_default: 'Default SMS {{firstName}}',
  sms_available_variables: ['{{firstName}}'],
});

const RESPONSE = {
  moments: {
    reschedule_link: tpl(),
    reoffer: tpl(),
    cancel_notice: { ...tpl({ is_override: true }), available_variables: ['{{firstName}}', '{{rebookText}}', '{{rebookHtml}}'] },
  },
  stop_footer_note: 'An unsubscribe (STOP) line is appended automatically and cannot be removed.',
  sms_footer_note: 'A STOP/HELP line is appended automatically to every SMS.',
};

beforeEach(() => api.fetchNotificationTemplates.mockResolvedValue(RESPONSE));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NotificationTemplatesEditor (E14)', () => {
  it('renders the 3 moments, the read-only STOP note, and per-moment variables', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    expect(screen.getByText('Reoffer (slot taken)')).toBeInTheDocument();
    expect(screen.getByText('Cancellation notice')).toBeInTheDocument();
    expect(screen.getByText(/unsubscribe \(STOP\) line is appended automatically/i)).toBeInTheDocument();
    // there is no editable STOP field
    expect(screen.queryByLabelText(/stop/i)).not.toBeInTheDocument();
    // cancel_notice exposes rebook vars (per-moment)
    const cancelCard = screen.getByText('Cancellation notice').closest('div')!.parentElement!.parentElement!;
    expect(within(cancelCard).getByText('{{rebookHtml}}')).toBeInTheDocument();
  });

  it('shows Customized vs Default badges and only offers Reset on an override', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    expect(screen.getAllByText('Default').length).toBe(2);   // reschedule_link + reoffer
    expect(screen.getByText('Customized')).toBeInTheDocument(); // cancel_notice
    expect(screen.getAllByRole('button', { name: /reset to default/i }).length).toBe(1);
  });

  it('saves an edited subject via PATCH and reloads', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reschedule_link', template: tpl({ is_override: true }) });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    const subj = screen.getAllByLabelText('Subject')[0];
    await userEvent.clear(subj);
    await userEvent.type(subj, 'New subject');
    await userEvent.click(screen.getAllByRole('button', { name: /^save$/i })[0]);

    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateNotificationTemplate).toHaveBeenCalledWith(
      'reschedule_link',
      expect.objectContaining({ subject: 'New subject' }),
    );
    // a reload follows the save (initial load + >=1 reload)
    await waitFor(() => expect(api.fetchNotificationTemplates.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('reset clears all override fields (empty strings → default)', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'cancel_notice', template: tpl() });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Cancellation notice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /reset to default/i }));
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateNotificationTemplate).toHaveBeenCalledWith('cancel_notice', { subject: '', body_text: '', body_html: '' });
  });

  it('renders an SMS field per moment with a segment hint + held-delivery note', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    expect(screen.getAllByLabelText('SMS text').length).toBe(3);
    expect(screen.getAllByText(/segment/i).length).toBe(3);
    expect(screen.getAllByText(/SMS delivery isn't enabled yet/i).length).toBe(3);
  });

  it('Save SMS PATCHes only sms_text (never the email fields)', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reschedule_link', template: tpl({ sms_is_override: true }) });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    const sms = screen.getAllByLabelText('SMS text')[0];
    await userEvent.clear(sms);
    await userEvent.type(sms, 'New SMS copy');
    await userEvent.click(screen.getAllByRole('button', { name: /^save sms$/i })[0]);

    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateNotificationTemplate).toHaveBeenCalledWith('reschedule_link', { sms_text: 'New SMS copy' });
  });

  it('email Save never writes the SMS field (no cross-contamination)', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reschedule_link', template: tpl({ is_override: true }) });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button', { name: /^save$/i })[0]);
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    const [, body] = api.updateNotificationTemplate.mock.calls[0];
    expect(body).not.toHaveProperty('sms_text');
    expect(body).toHaveProperty('subject');
  });

  it('seeds editable fields from the OVERRIDE only — a default moment starts blank with the default as placeholder (audit row 7)', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    // reschedule_link is NOT an override → fields must be empty (so "Save" can't persist the
    // platform default AS a tenant override), with the default surfaced as a placeholder.
    const subj = screen.getAllByLabelText('Subject')[0] as HTMLInputElement;
    expect(subj.value).toBe('');
    expect(subj).toHaveAttribute('placeholder', 'Default subject');
    const sms = screen.getAllByLabelText('SMS text')[0] as HTMLTextAreaElement;
    expect(sms.value).toBe('');
    expect(sms).toHaveAttribute('placeholder', 'Default SMS {{firstName}}');
  });

  it('seeds an existing override INTO the field so it stays editable (audit row 7)', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Cancellation notice')).toBeInTheDocument());
    // cancel_notice is is_override:true with subject 'Default subject' (the override value here).
    const cancelCard = screen.getByText('Cancellation notice').closest('div')!.parentElement!.parentElement!;
    const subj = within(cancelCard).getByLabelText('Subject') as HTMLInputElement;
    expect(subj.value).toBe('Default subject'); // the override is loaded, not blanked
  });

  it('schema discipline: a moment missing available_variables does not crash (audit row 8)', async () => {
    api.fetchNotificationTemplates.mockResolvedValue({
      ...RESPONSE,
      moments: {
        ...RESPONSE.moments,
        // drop available_variables + sms_available_variables (old-shape row)
        reoffer: { ...tpl(), available_variables: undefined, sms_available_variables: undefined },
      },
    });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reoffer (slot taken)')).toBeInTheDocument());
    // renders without throwing; the variables line is simply omitted for that moment
    expect(screen.getByText('Reoffer (slot taken)')).toBeInTheDocument();
  });

  it('offers Reset SMS only on an SMS override → clears it', async () => {
    api.fetchNotificationTemplates.mockResolvedValue({
      ...RESPONSE,
      moments: { ...RESPONSE.moments, reoffer: tpl({ sms_is_override: true }) },
    });
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reoffer', template: tpl() });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reoffer (slot taken)')).toBeInTheDocument());

    const resets = screen.getAllByRole('button', { name: /^reset sms$/i });
    expect(resets.length).toBe(1);
    await userEvent.click(resets[0]);
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledWith('reoffer', { sms_text: '' }));
  });
});

// ─── S4d: the S4 moments (reminder_24h / reminder_1h / confirmation) ──────────────────

describe('S4 moments', () => {
  it('renders the reminder + confirmation editors when the API returns them', async () => {
    api.fetchNotificationTemplates.mockResolvedValue({
      ...RESPONSE,
      moments: {
        ...RESPONSE.moments,
        reminder_24h: tpl(),
        reminder_1h: tpl(),
        confirmation: tpl(),
      },
    });
    render(<NotificationTemplatesEditor />);
    expect(await screen.findByText('Reminder (24 hours)')).toBeInTheDocument();
    expect(screen.getByText('Reminder (1 hour)')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation')).toBeInTheDocument();
    // The confirmation hint carries the can't-remove-links invariant for the admin:
    expect(screen.getByText(/calendar invite \(\.ics\)/)).toBeInTheDocument();
  });

  it('stays graceful against an older ADA that does not return the S4 moments', async () => {
    render(<NotificationTemplatesEditor />); // RESPONSE has only the 3 v1 moments
    expect(await screen.findByText('Reschedule link')).toBeInTheDocument();
    expect(screen.queryByText('Reminder (24 hours)')).toBeNull();
    expect(screen.queryByText('Booking confirmation')).toBeNull();
  });
});
