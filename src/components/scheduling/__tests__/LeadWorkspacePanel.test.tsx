import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadWorkspacePanel, type LeadWorkspaceLead } from '../LeadWorkspacePanel';

const lead: LeadWorkspaceLead = {
  name: 'Marcus Bell',
  relationship: 'Returning',
  appName: 'Mentor Application',
  program: 'Mentoring',
  phone: '(404) 555-0109',
  email: 'marcus@example.invalid',
  note: 'Recently retired from finance.',
  phase: 'Reviewing',
  appointments: [{ dow: 'Sun', day: '21', title: 'Intro Call', time: '9:30 AM', dispo: 'Booked' }],
  fields: [
    { label: 'Name', value: 'Marcus Bell' },
    { label: 'Email', value: 'marcus@example.invalid' },
  ],
  activity: [{ label: 'Intro Call booked', meta: 'via Picasso' }],
};

afterEach(cleanup);

describe('LeadWorkspacePanel', () => {
  it('renders nothing when there is no lead', () => {
    const { container } = render(<LeadWorkspacePanel lead={null} isOpen onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the header: name, relationship pill, app name', () => {
    render(<LeadWorkspacePanel lead={lead} isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /lead workspace/i })).toBeInTheDocument();
    expect(screen.getByText('Marcus Bell')).toBeInTheDocument();
    expect(screen.getByText('Returning')).toBeInTheDocument();
    expect(screen.getByText('Mentor Application')).toBeInTheDocument();
  });

  it('overview shows program, the note, and the current contact phase', () => {
    render(<LeadWorkspacePanel lead={lead} isOpen onClose={() => {}} />);
    expect(screen.getByText('Mentoring')).toBeInTheDocument();
    expect(screen.getByText(/recently retired from finance/i)).toBeInTheDocument();
    expect(screen.getByText('Reviewing')).toBeInTheDocument(); // the highlighted phase pill
  });

  it('switches tabs to Form Responses and Activity', async () => {
    render(<LeadWorkspacePanel lead={lead} isOpen onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: /form responses/i }));
    expect(screen.getByText(/2 fields submitted/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /activity/i }));
    expect(screen.getByText('Intro Call booked')).toBeInTheDocument();
  });

  it('degrades to honest empty states when lead data is missing', async () => {
    render(<LeadWorkspacePanel lead={{ name: 'No Data' }} isOpen onClose={() => {}} />);
    expect(screen.getByText(/conversation context appears here/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /form responses/i }));
    expect(screen.getByText(/form responses appear here/i)).toBeInTheDocument();
  });

  it('fires footer callbacks and shows the queue line', async () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onArchive = vi.fn();
    const onClose = vi.fn();
    render(
      <LeadWorkspacePanel
        lead={lead}
        isOpen
        onClose={onClose}
        onNext={onNext}
        onPrev={onPrev}
        onArchive={onArchive}
        queueCount={6}
      />,
    );
    expect(screen.getByText(/6 leads remaining in queue/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByRole('button', { name: /archive/i }));
    await userEvent.click(screen.getByRole('button', { name: /close lead workspace/i }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
