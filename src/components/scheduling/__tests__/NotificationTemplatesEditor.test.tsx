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
// org name feeds the live-preview "From {org}" line.
vi.mock('../../../context/useAuth', () => ({ useAuth: () => ({ user: { company: 'Atlanta Angels' } }) }));

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

// Open one moment's slide-over editor (rows are buttons named by the moment label).
async function openMoment(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog');
}

beforeEach(() => api.fetchNotificationTemplates.mockResolvedValue(RESPONSE));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NotificationTemplatesEditor (E14) — message list', () => {
  it('renders the returned moments as rows, the read-only STOP note, and Customized/Default meta', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    expect(screen.getByText('Time no longer available')).toBeInTheDocument();
    expect(screen.getByText('Cancellation notice')).toBeInTheDocument();
    // reassurance + compliance copy
    expect(screen.getByText(/works out of the box/i)).toBeInTheDocument();
    expect(screen.getByText(/unsubscribe \(STOP\) line is appended automatically/i)).toBeInTheDocument();
    // no fields are rendered until a row is opened
    expect(screen.queryByRole('dialog')).toBeNull();
    // Customized (cancel_notice override) vs Default (the other two) shown inline in each row
    expect(screen.getByText(/^Customized ·/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Default ·/).length).toBe(2);
  });

  it('only renders moments the API returns (graceful against an older ADA)', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    expect(screen.queryByText('Reminder — 24 hours before')).toBeNull();
    expect(screen.queryByText('Booking confirmation')).toBeNull();
  });

  it('opens a slide-over seeded from the OVERRIDE only — a default moment starts blank with the default as placeholder (audit row 7)', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    const dialog = await openMoment(/Reschedule link/);
    const subj = within(dialog).getByLabelText(/^subject$/i) as HTMLInputElement;
    expect(subj.value).toBe('');
    expect(subj).toHaveAttribute('placeholder', 'Default subject');
    const sms = within(dialog).getByLabelText(/text message/i) as HTMLTextAreaElement;
    expect(sms.value).toBe('');
    expect(sms).toHaveAttribute('placeholder', 'Default SMS {{firstName}}');
    // per-moment variable chips come from available_variables
    expect(within(dialog).getByRole('button', { name: '{{firstName}}' })).toBeInTheDocument();
  });

  it('seeds an existing override INTO the field so it stays editable (audit row 7)', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Cancellation notice')).toBeInTheDocument());
    const dialog = await openMoment(/Cancellation notice/);
    const subj = within(dialog).getByLabelText(/^subject$/i) as HTMLInputElement;
    expect(subj.value).toBe('Default subject'); // the override value is loaded, not blanked
    // override moments expose the per-moment vars too
    expect(within(dialog).getByRole('button', { name: '{{rebookHtml}}' })).toBeInTheDocument();
  });

  it('tap-to-insert appends a variable to the message body', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    const dialog = await openMoment(/Reschedule link/);
    await userEvent.click(within(dialog).getByRole('button', { name: '{{firstName}}' }));
    const body = within(dialog).getByLabelText(/^message$/i) as HTMLTextAreaElement;
    expect(body.value).toContain('{{firstName}}');
  });

  it('Save changes PATCHes the edited copy (subject + body + html + sms) and reloads', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reschedule_link', template: tpl({ is_override: true }) });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());

    const dialog = await openMoment(/Reschedule link/);
    const subj = within(dialog).getByLabelText(/^subject$/i);
    await userEvent.clear(subj);
    await userEvent.type(subj, 'New subject');
    await userEvent.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateNotificationTemplate).toHaveBeenCalledWith(
      'reschedule_link',
      expect.objectContaining({ subject: 'New subject' }),
    );
    await waitFor(() => expect(api.fetchNotificationTemplates.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('offers Reset only on an override and clears every field (empty strings → default)', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'cancel_notice', template: tpl() });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Cancellation notice')).toBeInTheDocument());

    // a non-override moment shows no Reset…
    let dialog = await openMoment(/Reschedule link/);
    expect(within(dialog).queryByRole('button', { name: /reset to default/i })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: /close editor/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // …but the override moment does, and resetting clears all fields.
    dialog = await openMoment(/Cancellation notice/);
    await userEvent.click(within(dialog).getByRole('button', { name: /reset to default/i }));
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateNotificationTemplate).toHaveBeenCalledWith('cancel_notice', {
      subject: '', body_text: '', body_html: '', sms_text: '',
    });
  });

  it('shows the SMS field with a segment hint and the held-delivery note', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    const dialog = await openMoment(/Reschedule link/);
    expect(within(dialog).getByLabelText(/text message/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/segment/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/SMS delivery isn't live yet/i)).toBeInTheDocument();
  });

  it('renders a live preview that resolves variables with sample data', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    const dialog = await openMoment(/Reschedule link/);
    const subj = within(dialog).getByLabelText(/^subject$/i);
    await userEvent.clear(subj);
    await userEvent.type(subj, 'Hi {{firstName}}');
    // {{firstName}} → sample "Alex"; "From {org}" pulls the tenant company name
    expect(within(dialog).getByText('Hi Alex')).toBeInTheDocument();
    expect(within(dialog).getByText('Atlanta Angels')).toBeInTheDocument();
  });

  it('closing the editor (✕) removes the dialog', async () => {
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Reschedule link')).toBeInTheDocument());
    const dialog = await openMoment(/Reschedule link/);
    await userEvent.click(within(dialog).getByRole('button', { name: /close editor/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('schema discipline: a moment missing available_variables does not crash (audit row 8)', async () => {
    api.fetchNotificationTemplates.mockResolvedValue({
      ...RESPONSE,
      moments: {
        ...RESPONSE.moments,
        reoffer: { ...tpl(), available_variables: undefined, sms_available_variables: undefined },
      },
    });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Time no longer available')).toBeInTheDocument());
    // opening it renders without throwing; the chip row is simply omitted
    const dialog = await openMoment(/Time no longer available/);
    expect(within(dialog).getByLabelText(/^subject$/i)).toBeInTheDocument();
  });

  it('toggles a message off via its switch (PATCH {enabled:false})', async () => {
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reoffer', template: {} });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Time no longer available')).toBeInTheDocument());
    const sw = screen.getByRole('switch', { name: /turn off Time no longer available/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledWith('reoffer', { enabled: false }));
  });

  it('does not flash the full-page spinner while re-fetching after a toggle (no section jump)', async () => {
    let resolveReload!: (v: unknown) => void;
    api.updateNotificationTemplate.mockResolvedValue({ moment: 'reoffer', template: {} });
    api.fetchNotificationTemplates
      .mockResolvedValueOnce(RESPONSE) // initial load
      .mockImplementationOnce(() => new Promise((r) => { resolveReload = r; })); // held-open silent reload
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Time no longer available')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('switch', { name: /turn off Time no longer available/i }));
    // reload is in flight — the section must stay mounted (no spinner remount that collapses layout)
    expect(screen.queryByText(/Loading messages/i)).toBeNull();
    expect(screen.getByText('Messages we send')).toBeInTheDocument();
    resolveReload(RESPONSE);
    await waitFor(() => expect(api.updateNotificationTemplate).toHaveBeenCalledTimes(1));
  });

  it('shows a disabled moment as Off with its switch unchecked', async () => {
    api.fetchNotificationTemplates.mockResolvedValue({
      ...RESPONSE,
      moments: { ...RESPONSE.moments, reoffer: { ...tpl(), enabled: false } },
    });
    render(<NotificationTemplatesEditor />);
    await waitFor(() => expect(screen.getByText('Time no longer available')).toBeInTheDocument());
    expect(screen.getByText(/Off — not sent/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /turn on Time no longer available/i })).toHaveAttribute('aria-checked', 'false');
  });
});

// ─── S4d: the S4 moments (reminder_24h / reminder_1h / confirmation) ──────────────────

describe('S4 moments', () => {
  it('renders the reminder + confirmation rows when the API returns them', async () => {
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
    expect(await screen.findByText('Reminder — 24 hours before')).toBeInTheDocument();
    expect(screen.getByText('Reminder — 1 hour before')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation')).toBeInTheDocument();
    // the confirmation editor carries the can't-remove-links invariant
    const dialog = await openMoment(/Booking confirmation/);
    expect(within(dialog).getByText(/calendar invite, .ics file and reschedule link are always included/i)).toBeInTheDocument();
  });

  it('stays graceful against an older ADA that does not return the S4 moments', async () => {
    render(<NotificationTemplatesEditor />); // RESPONSE has only the 3 v1 moments
    expect(await screen.findByText('Reschedule link')).toBeInTheDocument();
    expect(screen.queryByText('Reminder — 24 hours before')).toBeNull();
    expect(screen.queryByText('Booking confirmation')).toBeNull();
  });
});
