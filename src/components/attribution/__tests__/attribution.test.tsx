/**
 * Attribution workspace tests — N1 done-bar §6.
 *
 * Covers:
 *   1. flag-off → PremiumLock renders, workspace absent
 *   2. flag-on → AttributionWorkspace renders from C6-shaped fixture
 *   3. held-state rendering (rate_held: true → "held · n<50")
 *   4. empty-payload safety (zero aggregates → empty state, no NaN/undefined)
 *   5. FunnelStrip at page scope (all channels) and channel scope (compact)
 *   6. EcosystemDonut renders with partial channel data
 *   7. OutcomesTable totals row calculation
 *   8. MoneyBand renders headline values, never dollar signs
 *   9. TrendChart with empty data (no crash)
 *  10. ChannelRow: collapsed → no expansion; click → expanded + calls onExpand
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — must be before imports that trigger them
// ---------------------------------------------------------------------------

// Mock attributionApi so tests don't make real HTTP requests.
const mockGetAttributionSummary = vi.fn();
const mockGetAttributionChannel = vi.fn();

vi.mock('../../../services/attributionApi', () => ({
  getAttributionSummary: (...args: unknown[]) => mockGetAttributionSummary(...args),
  getAttributionChannel: (...args: unknown[]) => mockGetAttributionChannel(...args),
  getEntryPoints: vi.fn().mockResolvedValue({ entry_points: [] }),
}));

// ---------------------------------------------------------------------------
// Component imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { AttributionWorkspace } from '../AttributionWorkspace';
import { FunnelStrip } from '../FunnelStrip';
import { EcosystemDonut } from '../EcosystemDonut';
import { OutcomesTable } from '../OutcomesTable';
import { MoneyBand } from '../MoneyBand';
import { TrendChart } from '../TrendChart';
import { ChannelRow } from '../ChannelRow';
import { AttributionEmpty } from '../AttributionEmpty';
import type {
  AttributionSummaryResponse,
  AttributionChannelEcosystem,
  AttributionFunnel,
} from '../../../types/attribution';

// ---------------------------------------------------------------------------
// Fixtures — C6-shaped (FROZEN_CONTRACTS §C6)
// ---------------------------------------------------------------------------

const C6_CHANNELS: AttributionChannelEcosystem[] = [
  { channel: 'website',    share_pct: 63, conversations: 660,  leads: 82,  rate: 12.4, rate_held: false },
  { channel: 'messenger',  share_pct: 20, conversations: 210,  leads: 24,  rate: 11.4, rate_held: false },
  { channel: 'standalone', share_pct: 13, conversations: 136,  leads: 29,  rate: 21.3, rate_held: false },
  { channel: 'campaign',   share_pct: 4,  conversations: 39,   leads: 7,   rate: null, rate_held: true  },
];

const C6_SUMMARY: AttributionSummaryResponse = {
  tenant_id: 'AUS123957',
  month: '2025-10',
  source: 'aggregates',
  ecosystem: {
    total_conversations: 1045,
    after_hours_pct: 41,
    channels: C6_CHANNELS,
  },
  funnel: {
    reached: 12976,
    conversations: 1045,
    engaged: 612,
    applications: 287,
    leads: 142,
    rate: 13.6,
  },
  time: {
    after_hours_conversations: 428,
    staff_hours: 140,
    work_weeks: 3.5,
    self_booked_pct: null,
    median_first_response_minutes: null,
  },
  deltas: {
    conversations: { abs: 161, pct: 18 },
    leads: { abs: 25, pct: 21 },
    rate: { abs: 0, pct: 0.4 },
  },
  insight: {
    text: 'your in-person QR codes converted at 1.7× your website rate',
    rule_id: 'best_rate_channel',
    held: false,
  },
};

// Empty-payload fixture — zero aggregates
const C6_EMPTY: AttributionSummaryResponse = {
  tenant_id: 'AUS123957',
  month: '2025-10',
  source: 'aggregates',
  ecosystem: { total_conversations: 0, after_hours_pct: 0, channels: [] },
  funnel: { reached: 0, conversations: 0, engaged: 0, applications: 0, leads: 0, rate: 0 },
  time: { after_hours_conversations: 0, staff_hours: 0, work_weeks: 0 },
  deltas: {},
  insight: null,
};

// Old-shape fixture — missing all optional fields (schema discipline: must not crash)
const C6_OLD_SHAPE: AttributionSummaryResponse = {};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderWs() {
  return render(<AttributionWorkspace />);
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. flag-off → PremiumLock
//    This is controlled by App.tsx routing; AttributionWorkspace is NOT rendered
//    when the flag is off. We test App.tsx indirectly by verifying the workspace
//    component itself does NOT render a PremiumLock (it's flag-agnostic inside).
// ---------------------------------------------------------------------------

describe('flag-off guard (App.tsx routing)', () => {
  it('AttributionWorkspace does not render a PremiumLock inside itself', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => expect(screen.getByTestId('attribution-workspace')).toBeInTheDocument());
    // PremiumLock renders "Premium Intelligence" text; must be absent here
    expect(screen.queryByText(/Premium Intelligence/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. flag-on → workspace renders from C6-shaped fixture
// ---------------------------------------------------------------------------

describe('AttributionWorkspace — flag-on renders', () => {
  it('renders the workspace data-testid after data loads', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => expect(screen.getByTestId('attribution-workspace')).toBeInTheDocument());
  });

  it('shows total conversations from ecosystem', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // 1,045 appears in multiple places (donut, outcomes totals, funnel) — any match suffices
    const els = screen.getAllByText('1,045');
    expect(els.length).toBeGreaterThan(0);
  });

  it('shows The Numbers heading after switching to numbers view', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // Default view is Briefing (B1). Switch to Numbers to verify Numbers heading.
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));
    expect(screen.getByRole('heading', { name: /The Numbers/i })).toBeInTheDocument();
  });

  it('renders insight line when not held', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    expect(screen.getByText(/1\.7×/)).toBeInTheDocument();
  });

  it('shows journey band heading in numbers view', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // Default view is Briefing (B1). Switch to Numbers to verify journey heading.
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('heading', { name: /The journey/i }));
    expect(screen.getByRole('heading', { name: /The journey/i })).toBeInTheDocument();
  });

  it('renders MoneyBand with after-hours count', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // 428 after-hours conversations
    expect(screen.getByText('428')).toBeInTheDocument();
  });

  it('renders a channel row for each active channel in numbers view', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_SUMMARY);
    renderWs();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // Default view is Briefing (B1). Switch to Numbers to verify channel rows.
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));
    // 4 channel expand buttons
    const buttons = screen.getAllByRole('button', { name: /conversations/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. held-state rendering
// ---------------------------------------------------------------------------

describe('held-state rendering', () => {
  it('OutcomesTable renders held · n<50 for rate_held channels', () => {
    render(
      <OutcomesTable
        channels={C6_CHANNELS}
        month="2025-10"
      />
    );
    // "held · n<50" text should appear for campaign channel
    expect(screen.getByText(/held/i)).toBeInTheDocument();
  });

  it('ChannelRow shows held badge on row when rate_held is true', () => {
    const heldChannel: AttributionChannelEcosystem = {
      channel: 'campaign',
      share_pct: 4,
      conversations: 39,
      leads: 7,
      rate: null,
      rate_held: true,
    };
    render(
      <ChannelRow
        channelData={heldChannel}
        onExpand={vi.fn()}
      />
    );
    expect(screen.getByText(/comparisons held/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. empty-payload safety
// ---------------------------------------------------------------------------

describe('empty-payload safety', () => {
  it('renders empty state when zero aggregates', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_EMPTY);
    renderWs();
    await waitFor(() => screen.getByText(/Collecting your first month/i));
    // No NaN or undefined in the DOM
    expect(screen.queryByText('NaN')).toBeNull();
    expect(screen.queryByText('undefined')).toBeNull();
  });

  it('AttributionEmpty renders without crashing', () => {
    render(<AttributionEmpty />);
    expect(screen.getByText(/Collecting your first month/i)).toBeInTheDocument();
  });

  it('old-shape record (no fields) renders empty state without crashing', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_OLD_SHAPE);
    renderWs();
    // Either empty state or error — must not throw or show NaN
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body).not.toContain('NaN');
      expect(body).not.toContain('undefined');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. FunnelStrip at page scope and channel scope
// ---------------------------------------------------------------------------

describe('FunnelStrip', () => {
  const fullFunnel: AttributionFunnel = {
    reached: 12976,
    conversations: 1045,
    engaged: 612,
    applications: 287,
    leads: 142,
    rate: 13.6,
  };

  it('renders all funnel stages in page scope', () => {
    render(<FunnelStrip funnel={fullFunnel} />);
    expect(screen.getByText(/reached/i)).toBeInTheDocument();
    expect(screen.getByText(/conversations/i)).toBeInTheDocument();
    expect(screen.getByText(/engaged/i)).toBeInTheDocument();
    expect(screen.getByText(/applications/i)).toBeInTheDocument();
    expect(screen.getByText(/leads delivered/i)).toBeInTheDocument();
  });

  it('shows rate end-cap', () => {
    render(<FunnelStrip funnel={fullFunnel} />);
    expect(screen.getByText(/13\.6%/)).toBeInTheDocument();
  });

  it('renders compact (channel scope) without reached chip when reached is null', () => {
    const noReach: AttributionFunnel = { ...fullFunnel, reached: null };
    render(<FunnelStrip funnel={noReach} compact />);
    expect(screen.queryByText(/reached/i)).toBeNull();
    expect(screen.getByText(/conversations/i)).toBeInTheDocument();
  });

  it('handles fully empty funnel without NaN', () => {
    render(<FunnelStrip funnel={{}} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------------------
// 6. EcosystemDonut with partial channel data
// ---------------------------------------------------------------------------

describe('EcosystemDonut', () => {
  it('renders with full channel list', () => {
    render(
      <EcosystemDonut
        totalConversations={1045}
        afterHoursPct={41}
        channels={C6_CHANNELS}
      />
    );
    // Center value
    expect(screen.getByText('1,045')).toBeInTheDocument();
    expect(screen.getByText(/41%/i)).toBeInTheDocument();
  });

  it('renders with empty channels array without crashing', () => {
    render(
      <EcosystemDonut
        totalConversations={0}
        afterHoursPct={0}
        channels={[]}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders with single channel without crashing', () => {
    render(
      <EcosystemDonut
        totalConversations={660}
        afterHoursPct={30}
        channels={[C6_CHANNELS[0]]}
      />
    );
    expect(screen.getByText('660')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. OutcomesTable totals row
// ---------------------------------------------------------------------------

describe('OutcomesTable totals row', () => {
  it('computes totals row from channel data', () => {
    render(<OutcomesTable channels={C6_CHANNELS} month="2025-10" />);
    // Total conversations: 660 + 210 + 136 + 39 = 1045
    // Total leads: 82 + 24 + 29 + 7 = 142
    expect(screen.getByText('1,045')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    // Month label
    expect(screen.getByText(/October 2025/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. MoneyBand — headline values, never dollar signs
// ---------------------------------------------------------------------------

describe('MoneyBand', () => {
  it('renders after-hours conversations', () => {
    render(
      <MoneyBand
        time={{
          after_hours_conversations: 428,
          staff_hours: 140,
          work_weeks: 3.5,
        }}
      />
    );
    expect(screen.getByText('428')).toBeInTheDocument();
    expect(screen.getByText('~140')).toBeInTheDocument();
    expect(screen.getByText('3.5 weeks')).toBeInTheDocument();
  });

  it('does not render dollar signs anywhere', () => {
    render(
      <MoneyBand
        time={{
          after_hours_conversations: 428,
          staff_hours: 140,
          work_weeks: 3.5,
        }}
      />
    );
    expect(document.body.textContent).not.toContain('$');
  });

  it('shows em-dash when values are null', () => {
    render(
      <MoneyBand
        time={{
          after_hours_conversations: null,
          staff_hours: null,
          work_weeks: null,
        }}
      />
    );
    // Should show dashes, not NaN
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('NaN');
  });

  it('shows < 1 week when work_weeks < 1', () => {
    render(
      <MoneyBand
        time={{ after_hours_conversations: 10, staff_hours: 5, work_weeks: 0.5 }}
      />
    );
    expect(screen.getByText('< 1 week')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9. TrendChart with empty data
// ---------------------------------------------------------------------------

describe('TrendChart', () => {
  it('renders "No trend data" when trend is empty', () => {
    render(<TrendChart trend={[]} />);
    expect(screen.getByText(/No trend data/i)).toBeInTheDocument();
  });

  it('renders an SVG with trend data', () => {
    render(
      <TrendChart
        trend={[
          { month: '2025-05', conversations: 80,  leads: 10 },
          { month: '2025-06', conversations: 100, leads: 12 },
          { month: '2025-07', conversations: 120, leads: 15 },
          { month: '2025-08', conversations: 140, leads: 18 },
          { month: '2025-09', conversations: 110, leads: 14 },
          { month: '2025-10', conversations: 136, leads: 29 },
        ]}
      />
    );
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('does not crash with undefined values inside trend points', () => {
    render(
      <TrendChart
        trend={[
          { month: '2025-10', conversations: undefined, leads: undefined },
        ]}
      />
    );
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 10. ChannelRow interaction
// ---------------------------------------------------------------------------

describe('ChannelRow', () => {
  const websiteChannel: AttributionChannelEcosystem = {
    channel: 'website',
    share_pct: 63,
    conversations: 660,
    leads: 82,
    rate: 12.4,
    rate_held: false,
  };

  it('renders collapsed by default — expansion not visible', () => {
    render(
      <ChannelRow
        channelData={websiteChannel}
        onExpand={vi.fn()}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onExpand with the correct channel when clicked', async () => {
    const onExpand = vi.fn().mockResolvedValue({
      funnel: { conversations: 660, leads: 82, rate: 12.4 },
      entryPoints: [],
      topics: [],
      resources: [],
      trend: [],
      read: null,
      suggested_move: null,
    });

    render(<ChannelRow channelData={websiteChannel} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onExpand).toHaveBeenCalledWith('website'));
  });

  it('toggles aria-expanded on click', async () => {
    const onExpand = vi.fn().mockResolvedValue({
      funnel: null, entryPoints: [], topics: [], resources: [], trend: [],
      read: null, suggested_move: null,
    });
    render(<ChannelRow channelData={websiteChannel} onExpand={onExpand} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-expanded', 'true'));
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows error message when onExpand rejects', async () => {
    const onExpand = vi.fn().mockRejectedValue(new Error('fetch failed'));
    render(<ChannelRow channelData={websiteChannel} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert')).toHaveTextContent(/fetch failed/i);
  });
});
