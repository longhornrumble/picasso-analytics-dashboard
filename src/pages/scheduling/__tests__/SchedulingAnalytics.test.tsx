import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SchedulingAnalytics } from '../SchedulingAnalytics';
import { debtBookings, FIXTURE_NOW } from '../../../test/fixtures/schedulingFixture';

afterEach(cleanup);

describe('SchedulingAnalytics (Surface 8 — operational debt)', () => {
  it('admin sees tenant-wide debt buckets (4 / 3 / 2 / 1) and a per-staff breakdown', () => {
    render(
      <SchedulingAnalytics bookings={debtBookings} viewer={{ role: 'admin' }} now={FIXTURE_NOW} />,
    );
    expect(screen.getByText(/tenant-wide operational debt/i)).toBeInTheDocument();

    const debt = screen.getByRole('region', { name: /operational debt/i });
    // The four bucket counts, in order.
    expect(within(debt).getByText('> 24 hours').closest('div')).toHaveTextContent('4');
    expect(within(debt).getByText('> 72 hours').closest('div')).toHaveTextContent('3');
    expect(within(debt).getByText('> 7 days').closest('div')).toHaveTextContent('2');
    expect(within(debt).getByText('> 30 days').closest('div')).toHaveTextContent('1');

    // Per-staff breakdown present.
    expect(within(debt).getByText('maya.fixture@example.invalid')).toBeInTheDocument();
  });

  it('staff sees only their own debt (scoped), not the tenant aggregate', () => {
    render(
      <SchedulingAnalytics
        bookings={debtBookings}
        viewer={{ role: 'member', email: 'alex.fixture@example.invalid' }}
        now={FIXTURE_NOW}
      />,
    );
    expect(screen.getByText(/your own bookings awaiting disposition/i)).toBeInTheDocument();
    const debt = screen.getByRole('region', { name: /operational debt/i });
    // Alex owns exactly one debt row (the 8d one) → over24h:1, over30d:0.
    expect(within(debt).getByText('> 24 hours').closest('div')).toHaveTextContent('1');
    expect(within(debt).getByText('> 30 days').closest('div')).toHaveTextContent('0');
    // Maya's rows are not visible to a staff viewer.
    expect(within(debt).queryByText('maya.fixture@example.invalid')).toBeNull();
  });
});
