import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingPage } from '../SchedulingPage';

// Drive the viewer identity through the auth hook the page consumes.
const mockUser = vi.fn();
vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: mockUser() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SchedulingPage (E12 + E15 container)', () => {
  it('renders the My Bookings sub-tab by default (admin viewer)', async () => {
    mockUser.mockReturnValue({ role: 'admin', email: 'admin@example.invalid' });
    render(<SchedulingPage />);

    // Spinner first, then content once the (stubbed) fetch resolves.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /my bookings/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('switches to the Analytics sub-tab on click', async () => {
    mockUser.mockReturnValue({ role: 'admin', email: 'admin@example.invalid' });
    render(<SchedulingPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /my bookings/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /analytics/i }));
    expect(
      screen.getByRole('heading', { name: /scheduling analytics/i }),
    ).toBeInTheDocument();
  });

  it('a staff viewer with no bookings of their own sees the empty state', async () => {
    // Staff scope: visibleBookings joins on coordinator_email; an unknown email matches none.
    mockUser.mockReturnValue({ role: 'member', email: 'nobody@example.invalid' });
    render(<SchedulingPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /my bookings/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/no bookings match these filters/i)).toBeInTheDocument();
  });

  it('renders an error state (not a crash) when the load fails', async () => {
    // Re-import the page against a failing hook so the error branch is exercised.
    vi.resetModules();
    vi.doMock('../../../lib/scheduling/useBookings', () => ({
      useBookings: () => ({ bookings: [], loading: false, error: 'boom' }),
    }));
    vi.doMock('../../../context/useAuth', () => ({
      useAuth: () => ({ user: { role: 'admin', email: 'admin@example.invalid' } }),
    }));
    const { SchedulingPage: FreshPage } = await import('../SchedulingPage');

    render(<FreshPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load bookings: boom/i);

    vi.doUnmock('../../../lib/scheduling/useBookings');
    vi.doUnmock('../../../context/useAuth');
  });
});
