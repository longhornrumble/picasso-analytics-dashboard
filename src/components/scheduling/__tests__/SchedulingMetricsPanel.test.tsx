import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SchedulingMetricsPanel } from '../SchedulingMetricsPanel';
import {
  allBookings,
  FIXTURE_NOW,
  appointmentTypeNames,
} from '../../../test/fixtures/schedulingFixture';

afterEach(cleanup);

const cardValue = (label: RegExp | string) =>
  screen.getByText(label).closest('div')!;

describe('SchedulingMetricsPanel (Surface 8 historical metrics)', () => {
  it('renders volume + outcome rate cards from the fixture', () => {
    render(<SchedulingMetricsPanel bookings={allBookings} now={FIXTURE_NOW} />);

    expect(within(cardValue('Total bookings')).getByText('11')).toBeInTheDocument();
    expect(within(cardValue('Upcoming')).getByText('0')).toBeInTheDocument();
    expect(within(cardValue('Last 30 days')).getByText('3')).toBeInTheDocument();
    // no-show + completion are both 1/3 → 33%
    expect(within(cardValue('No-show rate')).getByText('33%')).toBeInTheDocument();
    expect(within(cardValue('Cancellation rate')).getByText('9%')).toBeInTheDocument();
  });

  it('shows em-dash rates (not 0%) when there is nothing to rate', () => {
    render(<SchedulingMetricsPanel bookings={[]} now={FIXTURE_NOW} />);
    expect(within(cardValue('Total bookings')).getByText('0')).toBeInTheDocument();
    expect(within(cardValue('No-show rate')).getByText('—')).toBeInTheDocument();
  });

  it('renders the per-appointment-type no-show breakdown when names are provided (admin)', () => {
    render(
      <SchedulingMetricsPanel
        bookings={allBookings}
        now={FIXTURE_NOW}
        appointmentTypeNames={appointmentTypeNames}
      />,
    );
    expect(screen.getByText('No-show rate by appointment type')).toBeInTheDocument();
    // Discovery: 1 no_show of 2 disposed → 50%; Interview: 0 of 1 → 0%.
    const discRow = screen.getByText('Discovery Session (30 min)').closest('li')!;
    expect(within(discRow).getByText('50%')).toBeInTheDocument();
    const intvRow = screen.getByText('Volunteer Interview (60 min)').closest('li')!;
    expect(within(intvRow).getByText('0%')).toBeInTheDocument();
  });

  it('hides the per-type breakdown when no names map is provided (staff own-view)', () => {
    render(<SchedulingMetricsPanel bookings={allBookings} now={FIXTURE_NOW} />);
    expect(screen.queryByText('No-show rate by appointment type')).not.toBeInTheDocument();
  });
});
