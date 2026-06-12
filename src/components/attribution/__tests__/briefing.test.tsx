/**
 * Attribution Briefing tests — B1/B3/B4 done-bar.
 *
 * Covers:
 *  1.  default view = briefing (data-testid="attribution-briefing" visible)
 *  2.  view switching: briefing → numbers (both directions)
 *  3.  deep link: fires onDeepLinkChannel → Numbers ChannelRow expands
 *  4.  §03 fallback renders (aggregate-only; no per-session data)
 *  5.  narrative: up-month — lede contains conversations count, no dollar sign
 *  6.  narrative: down-month — leads with best true thing, states dip plainly
 *  7.  narrative: sparse-month — below-floor phrasing
 *  8.  narrative: empty-month — "no activity" fallback
 *  9.  MoneyBand (time-strip) renders in briefing — never dollar signs
 * 10.  FunnelStrip reused in §01
 * 11.  channel interpretations (§04): below-floor gets "too early to judge"
 * 12.  print stylesheet class assertions (briefing-root, briefing-epistemic)
 * 13.  no dollar sign anywhere in any variant
 * 14.  no NaN anywhere in any variant
 * 15.  briefingNarrative: buildLede fixtures (up/down/sparse/empty)
 * 16.  briefingNarrative: buildChannelInterpretations below-floor phrasing
 * 17.  briefingNarrative: buildRecommendationCards tier mapping
 * 18.  AttributionWorkspace default view = briefing
 * 19.  AttributionWorkspace → Numbers view via "open the numbers" link
 * 20.  AttributionWorkspace → back to briefing via "back to briefing" crumb
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockGetAttributionSummary = vi.fn();
const mockGetAttributionChannel = vi.fn();

vi.mock('../../../services/attributionApi', () => ({
  getAttributionSummary: (...args: unknown[]) => mockGetAttributionSummary(...args),
  getAttributionChannel: (...args: unknown[]) => mockGetAttributionChannel(...args),
  getEntryPoints: vi.fn().mockResolvedValue({ entry_points: [] }),
}));

// ---------------------------------------------------------------------------
// Component + narrative imports
// ---------------------------------------------------------------------------

import { AttributionWorkspace } from '../AttributionWorkspace';
import { AttributionBriefing } from '../AttributionBriefing';
import {
  buildLede,
  buildChannelInterpretations,
  buildRecommendationCards,
  isDownMonth,
  isSparseMonth,
} from '../briefingNarrative';
import type {
  AttributionSummaryResponse,
  AttributionChannelEcosystem,
  AttributionAdviceBox,
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

const C6_UP: AttributionSummaryResponse = {
  tenant_id: 'AUS123957',
  month: '2025-10',
  source: 'aggregates',
  ecosystem: { total_conversations: 1045, after_hours_pct: 41, channels: C6_CHANNELS },
  funnel: { reached: 12976, conversations: 1045, engaged: 612, applications: 287, leads: 142, rate: 13.6 },
  time: { after_hours_conversations: 428, staff_hours: 140, work_weeks: 3.5, self_booked_pct: 58, median_first_response_minutes: 1320 },
  deltas: { conversations: { abs: 161, pct: 18 }, leads: { abs: 25, pct: 21 }, rate: { abs: 0, pct: 0.4 } },
  insight: { text: 'QR codes converted at 1.7x your website rate', rule_id: 'best_rate_channel', held: false },
};

const C6_DOWN: AttributionSummaryResponse = {
  ...C6_UP,
  month: '2025-11',
  deltas: { conversations: { abs: -100, pct: -10 }, leads: { abs: -20, pct: -14 } },
};

const C6_SPARSE: AttributionSummaryResponse = {
  tenant_id: 'AUS123957',
  month: '2025-10',
  source: 'aggregates',
  ecosystem: { total_conversations: 12, after_hours_pct: 0, channels: [] },
  funnel: { conversations: 12, engaged: 3, leads: 1 },
  time: {},
  deltas: {},
  insight: null,
};

const C6_EMPTY: AttributionSummaryResponse = {
  tenant_id: 'AUS123957',
  month: '2025-10',
  source: 'aggregates',
  ecosystem: { total_conversations: 0, after_hours_pct: 0, channels: [] },
  funnel: { conversations: 0, engaged: 0, leads: 0 },
  time: {},
  deltas: {},
  insight: null,
};

const C6_OLD_SHAPE: AttributionSummaryResponse = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function renderWorkspace() {
  return render(<AttributionWorkspace />);
}

// ---------------------------------------------------------------------------
// 1. Default view = briefing
// ---------------------------------------------------------------------------

describe('1. AttributionWorkspace — default view', () => {
  it('renders briefing view by default (data-testid="attribution-briefing")', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(screen.getByTestId('attribution-briefing')).toBeInTheDocument();
  });

  it('does NOT render Numbers heading by default', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(screen.queryByRole('heading', { name: /The Numbers/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. View switching
// ---------------------------------------------------------------------------

describe('2. View switching', () => {
  it('switches to Numbers when "open the numbers" is clicked', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));

    // aria-label is "Switch to numbers charts view"
    const numbersBtn = screen.getByRole('button', { name: /switch to numbers/i });
    fireEvent.click(numbersBtn);
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));
    expect(screen.queryByTestId('attribution-briefing')).toBeNull();
  });

  it('switches back to briefing when "back to briefing" crumb is clicked', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));

    // Go to Numbers
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));

    // Go back to briefing
    fireEvent.click(screen.getByRole('button', { name: /back to briefing/i }));
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(screen.getByTestId('attribution-briefing')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Deep link (briefing channel → Numbers expand)
// ---------------------------------------------------------------------------

describe('3. Deep link', () => {
  it('switches to numbers view when a channel deep-link is clicked', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    mockGetAttributionChannel.mockResolvedValue({
      funnel: { conversations: 660 },
      entry_points: [],
      topics: [],
      resources: [],
      trend: [],
      read: null,
      suggested_move: null,
    });
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));

    // Click the deep-link button for "Website widget" in §04
    const deepLinkBtn = screen.getByRole('button', { name: /Website widget/i });
    fireEvent.click(deepLinkBtn);

    // Should switch to Numbers view
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));
    expect(screen.queryByTestId('attribution-briefing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. §03 aggregate-only fallback
// ---------------------------------------------------------------------------

describe('4. §03 fallback', () => {
  it('renders section-03 with aggregate fallback (no per-session data)', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-section-03'));
    expect(screen.getByTestId('briefing-section-03')).toBeInTheDocument();
    // Must use aggregate-only fallback
    expect(screen.getByTestId('briefing-section-03-fallback')).toBeInTheDocument();
    // Must say "no individual session data"
    expect(screen.getByText(/no individual session data/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Narrative: up-month lede
// ---------------------------------------------------------------------------

describe('5. Narrative — up-month lede', () => {
  it('lede contains conversations count', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-lede'));
    const lede = screen.getByTestId('briefing-lede');
    expect(lede.textContent).toMatch(/1,045/);
  });

  it('lede contains after-hours count', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-lede'));
    const lede = screen.getByTestId('briefing-lede');
    expect(lede.textContent).toMatch(/428/);
  });

  it('lede contains staff-hours', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-lede'));
    const lede = screen.getByTestId('briefing-lede');
    // "~140 staff-hours" or similar
    expect(lede.textContent).toMatch(/140/);
  });
});

// ---------------------------------------------------------------------------
// 6. Narrative: down-month
// ---------------------------------------------------------------------------

describe('6. Narrative — down-month (B4)', () => {
  it('isDownMonth returns true for negative deltas', () => {
    expect(isDownMonth(C6_DOWN)).toBe(true);
  });

  it('isDownMonth returns false for positive deltas', () => {
    expect(isDownMonth(C6_UP)).toBe(false);
  });

  it('down-month lede leads with best true thing (no spin)', () => {
    const slots = buildLede(C6_DOWN);
    expect(slots.variant).toBe('down');
    // First sentence should be positive — best channel rate
    const first = slots.sentences[0].toLowerCase();
    expect(first).toMatch(/converted at|leads delivered/);
  });

  it('down-month lede states the dip plainly', () => {
    const slots = buildLede(C6_DOWN);
    const combined = slots.sentences.join(' ').toLowerCase();
    expect(combined).toMatch(/down/);
  });

  it('down-month lede contains no dollar sign', () => {
    const slots = buildLede(C6_DOWN);
    const combined = slots.sentences.join(' ');
    expect(combined).not.toContain('$');
  });
});

// ---------------------------------------------------------------------------
// 7. Narrative: sparse-month
// ---------------------------------------------------------------------------

describe('7. Narrative — sparse-month', () => {
  it('isSparseMonth returns true when total < 50', () => {
    expect(isSparseMonth(C6_SPARSE)).toBe(true);
  });

  it('sparse lede uses "not enough data" phrasing', () => {
    const slots = buildLede(C6_SPARSE);
    expect(slots.variant).toBe('sparse');
    const combined = slots.sentences.join(' ').toLowerCase();
    expect(combined).toMatch(/not yet enough data|early month/);
  });
});

// ---------------------------------------------------------------------------
// 8. Narrative: empty-month
// ---------------------------------------------------------------------------

describe('8. Narrative — empty-month', () => {
  it('empty lede uses empty variant', () => {
    const slots = buildLede(C6_EMPTY);
    expect(slots.variant).toBe('empty');
  });

  it('empty lede does not claim conversations happened', () => {
    const slots = buildLede(C6_EMPTY);
    const combined = slots.sentences.join(' ').toLowerCase();
    // Must not imply activity occurred
    expect(combined).toMatch(/no conversations|check back/);
    // Must not contain dollar sign
    expect(combined).not.toContain('$');
    // Must not contain NaN
    expect(combined).not.toContain('nan');
  });
});

// ---------------------------------------------------------------------------
// 9. Time-strip in briefing — never dollar signs
// ---------------------------------------------------------------------------

describe('9. Time-strip in briefing', () => {
  it('renders section-02 with after-hours count', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-section-02'));
    const s02 = screen.getByTestId('briefing-section-02');
    expect(s02.textContent).toMatch(/428/);
  });

  it('no dollar sign in section-02', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-section-02'));
    const s02 = screen.getByTestId('briefing-section-02');
    expect(s02.textContent).not.toContain('$');
  });

  it('shows work-weeks in section-02', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-section-02'));
    const s02 = screen.getByTestId('briefing-section-02');
    expect(s02.textContent).toMatch(/3\.5 weeks/);
  });
});

// ---------------------------------------------------------------------------
// 10. FunnelStrip reused in §01
// ---------------------------------------------------------------------------

describe('10. FunnelStrip in §01', () => {
  it('renders briefing-funnel-strip inside section-01', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('briefing-funnel-strip'));
    expect(screen.getByTestId('briefing-funnel-strip')).toBeInTheDocument();
    // Conversations count visible in funnel
    expect(screen.getAllByText('1,045').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11. §04 channel interpretations — below-floor phrasing
// ---------------------------------------------------------------------------

describe('11. §04 channel interpretations', () => {
  it('below-floor channel gets "too early to judge" phrasing', () => {
    const channels = buildChannelInterpretations(C6_CHANNELS);
    const campaign = channels.find((c) => c.channel === 'campaign');
    expect(campaign).toBeDefined();
    expect(campaign!.read.toLowerCase()).toMatch(/too early to judge/);
    expect(campaign!.stat).toMatch(/too early to judge/);
  });

  it('above-floor channel does NOT get too-early phrasing', () => {
    const channels = buildChannelInterpretations(C6_CHANNELS);
    const website = channels.find((c) => c.channel === 'website');
    expect(website).toBeDefined();
    expect(website!.read.toLowerCase()).not.toMatch(/too early/);
  });

  it('handles empty channels array', () => {
    const result = buildChannelInterpretations([]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Print stylesheet class assertions
// ---------------------------------------------------------------------------

describe('12. Print stylesheet classes', () => {
  it('briefing-root class is applied to the document wrapper', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    // briefing-root is on the inner div of AttributionBriefing
    const root = document.querySelector('.briefing-root');
    expect(root).toBeInTheDocument();
  });

  it('briefing-epistemic class is applied to the footer', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(document.querySelector('.briefing-epistemic')).toBeInTheDocument();
  });

  it('briefing-masthead class is applied', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(document.querySelector('.briefing-masthead')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 13. No dollar sign anywhere in any variant
// ---------------------------------------------------------------------------

describe('13. No dollar sign — all variants', () => {
  const variants: [string, AttributionSummaryResponse][] = [
    ['up', C6_UP],
    ['down', C6_DOWN],
    ['sparse', C6_SPARSE],
    ['empty', C6_EMPTY],
    ['old-shape', C6_OLD_SHAPE],
  ];

  variants.forEach(([name, fixture]) => {
    it(`no dollar sign in ${name} variant`, async () => {
      mockGetAttributionSummary.mockResolvedValue(fixture);
      renderWorkspace();
      // Wait for loading to finish
      await waitFor(() => {
        const ws = screen.queryByTestId('attribution-workspace');
        expect(ws).toBeInTheDocument();
      });
      expect(document.body.textContent).not.toContain('$');
    });
  });
});

// ---------------------------------------------------------------------------
// 14. No NaN — all variants
// ---------------------------------------------------------------------------

describe('14. No NaN — all variants', () => {
  const variants: [string, AttributionSummaryResponse][] = [
    ['up', C6_UP],
    ['down', C6_DOWN],
    ['sparse', C6_SPARSE],
    ['empty', C6_EMPTY],
    ['old-shape', C6_OLD_SHAPE],
  ];

  variants.forEach(([name, fixture]) => {
    it(`no NaN in ${name} variant`, async () => {
      mockGetAttributionSummary.mockResolvedValue(fixture);
      renderWorkspace();
      await waitFor(() => {
        expect(screen.queryByTestId('attribution-workspace')).toBeInTheDocument();
      });
      expect(document.body.textContent).not.toContain('NaN');
    });
  });
});

// ---------------------------------------------------------------------------
// 15. briefingNarrative: buildLede fixtures
// ---------------------------------------------------------------------------

describe('15. briefingNarrative: buildLede fixtures', () => {
  it('up-month: variant=up, has month label', () => {
    const slots = buildLede(C6_UP);
    expect(slots.variant).toBe('up');
    expect(slots.monthLabel).toBe('October 2025');
    expect(slots.sentences.length).toBeGreaterThan(0);
  });

  it('up-month: no NaN in any sentence', () => {
    const slots = buildLede(C6_UP);
    slots.sentences.forEach((s) => {
      expect(s).not.toContain('NaN');
      expect(s).not.toContain('$');
    });
  });

  it('down-month: variant=down', () => {
    const slots = buildLede(C6_DOWN);
    expect(slots.variant).toBe('down');
  });

  it('sparse-month: variant=sparse', () => {
    const slots = buildLede(C6_SPARSE);
    expect(slots.variant).toBe('sparse');
  });

  it('empty-month: variant=empty', () => {
    const slots = buildLede(C6_EMPTY);
    expect(slots.variant).toBe('empty');
  });

  it('null-tolerant: old-shape (no fields) does not crash', () => {
    expect(() => buildLede(C6_OLD_SHAPE)).not.toThrow();
    const slots = buildLede(C6_OLD_SHAPE);
    expect(slots.variant).toBe('empty');
  });

  it('null-tolerant: after_hours null → omit after-hours clause (no crash)', () => {
    const noAfterHours: AttributionSummaryResponse = {
      ...C6_UP,
      time: { ...C6_UP.time, after_hours_conversations: null },
    };
    const slots = buildLede(noAfterHours);
    const combined = slots.sentences.join(' ');
    expect(combined).not.toContain('null');
    expect(combined).not.toContain('NaN');
  });

  it('null-tolerant: work_weeks null → omit work-weeks clause (no crash)', () => {
    const noWorkWeeks: AttributionSummaryResponse = {
      ...C6_UP,
      time: { ...C6_UP.time, work_weeks: null, staff_hours: null },
    };
    const slots = buildLede(noWorkWeeks);
    const combined = slots.sentences.join(' ');
    expect(combined).not.toContain('null');
    expect(combined).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------------------
// 16. briefingNarrative: buildChannelInterpretations below-floor
// ---------------------------------------------------------------------------

describe('16. briefingNarrative: buildChannelInterpretations', () => {
  it('sorts channels by conversations descending', () => {
    const result = buildChannelInterpretations(C6_CHANNELS);
    expect(result[0].channel).toBe('website'); // 660 conversations — highest
  });

  it('below-floor (rate_held=true): stat says "too early to judge"', () => {
    const result = buildChannelInterpretations(C6_CHANNELS);
    const campaign = result.find((c) => c.channel === 'campaign');
    expect(campaign!.stat).toMatch(/too early to judge/i);
  });

  it('below-floor: read says "too early to judge"', () => {
    const result = buildChannelInterpretations(C6_CHANNELS);
    const campaign = result.find((c) => c.channel === 'campaign');
    expect(campaign!.read).toMatch(/too early to judge/i);
  });

  it('no NaN or undefined in stat/read for any channel', () => {
    const result = buildChannelInterpretations(C6_CHANNELS);
    result.forEach((ch) => {
      expect(ch.stat).not.toContain('NaN');
      expect(ch.stat).not.toContain('undefined');
      expect(ch.read).not.toContain('NaN');
    });
  });
});

// ---------------------------------------------------------------------------
// 17. briefingNarrative: buildRecommendationCards
// ---------------------------------------------------------------------------

describe('17. briefingNarrative: buildRecommendationCards', () => {
  const boxes: AttributionAdviceBox[] = [
    { text: 'Double down on QR codes', rule_id: 'best_rate', tier: 'double_down' },
    { text: 'Review eligibility flow', rule_id: 'low_conv', tier: 'worth_a_look' },
    { text: 'Too early on newsletter', rule_id: 'too_early', tier: 'too_early' },
  ];

  it('returns one card per advice box', () => {
    const cards = buildRecommendationCards(boxes);
    expect(cards).toHaveLength(3);
  });

  it('maps tier correctly', () => {
    const cards = buildRecommendationCards(boxes);
    expect(cards[0].tier).toBe('double_down');
    expect(cards[1].tier).toBe('worth_a_look');
    expect(cards[2].tier).toBe('too_early');
  });

  it('renders text verbatim as heading', () => {
    const cards = buildRecommendationCards(boxes);
    expect(cards[0].heading).toBe('Double down on QR codes');
  });

  it('filters out boxes with no text', () => {
    const withEmpty: AttributionAdviceBox[] = [
      ...boxes,
      { text: null, rule_id: 'empty', tier: 'too_early' },
    ];
    const cards = buildRecommendationCards(withEmpty);
    expect(cards).toHaveLength(3);
  });

  it('handles empty array without crashing', () => {
    const cards = buildRecommendationCards([]);
    expect(cards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 18. AttributionWorkspace — default view = briefing (via workspace testid)
// ---------------------------------------------------------------------------

describe('18. AttributionWorkspace default view', () => {
  it('workspace renders and briefing is default', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    await waitFor(() => screen.getByTestId('attribution-workspace'));
    // Briefing should be inside the workspace
    expect(screen.getByTestId('attribution-briefing')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 19. AttributionWorkspace → Numbers via "open the numbers"
// ---------------------------------------------------------------------------

describe('19. Switch to Numbers', () => {
  it('"open the numbers" button switches to Numbers view', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    // aria-label = "Switch to numbers charts view"
    await waitFor(() => screen.getByRole('button', { name: /switch to numbers/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('heading', { name: /The Numbers/i }));
    expect(screen.queryByTestId('attribution-briefing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 20. AttributionWorkspace → back to briefing crumb
// ---------------------------------------------------------------------------

describe('20. Back to briefing', () => {
  it('"back to briefing" crumb switches back from Numbers', async () => {
    mockGetAttributionSummary.mockResolvedValue(C6_UP);
    renderWorkspace();
    // aria-label = "Switch to numbers charts view"
    await waitFor(() => screen.getByRole('button', { name: /switch to numbers/i }));

    // Switch to numbers
    fireEvent.click(screen.getByRole('button', { name: /switch to numbers/i }));
    await waitFor(() => screen.getByRole('button', { name: /back to briefing/i }));

    // Switch back
    fireEvent.click(screen.getByRole('button', { name: /back to briefing/i }));
    await waitFor(() => screen.getByTestId('attribution-briefing'));
    expect(screen.getByTestId('attribution-briefing')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Bonus: AttributionBriefing unit render
// ---------------------------------------------------------------------------

describe('AttributionBriefing standalone render', () => {
  it('renders without crashing from C6-shaped fixture', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(screen.getByTestId('attribution-briefing')).toBeInTheDocument();
  });

  it('renders epistemic footer', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('no dollar sign in briefing component', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(document.body.textContent).not.toContain('$');
  });

  it('no NaN in briefing component', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('renders section headings for §01–§04', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(screen.getByTestId('briefing-section-01')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-section-02')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-section-03')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-section-04')).toBeInTheDocument();
  });

  it('renders §05 when advice boxes are provided', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[{ text: 'Put QR at events', rule_id: 'best_rate', tier: 'double_down' }]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(screen.getByTestId('briefing-section-05')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-rec-card-double_down')).toBeInTheDocument();
  });

  it('does not render §05 when advice boxes are empty', () => {
    render(
      <AttributionBriefing
        summary={C6_UP}
        adviceBoxes={[]}
        onSwitchToNumbers={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('briefing-section-05')).toBeNull();
  });

  it('old-shape fixture (no fields) does not crash', () => {
    expect(() =>
      render(
        <AttributionBriefing
          summary={C6_OLD_SHAPE}
          adviceBoxes={[]}
          onSwitchToNumbers={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('$');
  });
});
