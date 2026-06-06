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

const tpl = (over: Partial<{ subject: string; is_override: boolean }> = {}) => ({
  subject: over.subject ?? 'Default subject',
  body_text: 'Hi {{firstName}}',
  body_html: '<p>Hi {{firstName}}</p>',
  is_override: over.is_override ?? false,
  default: { subject: 'Default subject', body_text: 'Hi {{firstName}}', body_html: '<p>Hi {{firstName}}</p>' },
  available_variables: ['{{firstName}}', '{{actionUrl}}'],
});

const RESPONSE = {
  moments: {
    reschedule_link: tpl(),
    reoffer: tpl(),
    cancel_notice: { ...tpl({ is_override: true }), available_variables: ['{{firstName}}', '{{rebookText}}', '{{rebookHtml}}'] },
  },
  stop_footer_note: 'An unsubscribe (STOP) line is appended automatically and cannot be removed.',
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
});
