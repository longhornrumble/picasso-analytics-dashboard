/**
 * briefingNarrative.ts — deterministic template engine for Attribution Briefing.
 *
 * B1 spec: pure module, NO LLM. Computed slots from C6 API payloads.
 * B4 spec: down-month variants — leads with the best true thing, states dip
 *          plainly, never spins.
 *
 * Ref: FROZEN_CONTRACTS.md §C6/§C7, ATTRIBUTION_SURFACE_BRIEFING.md §B1/§B4.
 * Templates cite C7 definitions for every term used.
 */

import type {
  AttributionSummaryResponse,
  AttributionChannelEcosystem,
  AttributionAdviceBox,
} from '../../types/attribution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString();
}

function pct(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

/** Work-weeks display: "3.5 weeks" or "< 1 week" (C7 definition: staff_hours / 40). */
function fmtWorkWeeks(ww: number | null | undefined): string {
  if (ww == null || isNaN(ww)) return '—';
  if (ww < 1) return 'less than one work-week';
  return `${ww.toFixed(1)} work-weeks`;
}

/** Staff-hours display: "~140 staff-hours". */
function fmtStaffHours(h: number | null | undefined): string {
  if (h == null || isNaN(h)) return '—';
  return `~${Math.round(h)} staff-hours`;
}

/** Returns the channel with highest conversion rate (both above C7 floor). */
function bestRateChannel(
  channels: AttributionChannelEcosystem[],
): AttributionChannelEcosystem | null {
  const eligible = channels.filter(
    (c) => c.rate != null && !c.rate_held && (c.conversations ?? 0) >= 50,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) =>
    (c.rate ?? 0) > (best.rate ?? 0) ? c : best,
  );
}

/** Month label: "October 2025" from "2025-10". */
export function monthLabel(iso: string): string {
  try {
    const [y, m] = iso.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Down-month detection (B4)
// ---------------------------------------------------------------------------

/**
 * Returns true when this is a "down month" — any of the primary metrics
 * declined vs prior period.
 */
export function isDownMonth(summary: AttributionSummaryResponse): boolean {
  const deltas = summary.deltas ?? {};
  const convDelta = deltas.conversations?.pct;
  const leadsDelta = deltas.leads?.pct;
  // Negative delta on conversations OR leads = down month
  return (convDelta != null && convDelta < 0) || (leadsDelta != null && leadsDelta < 0);
}

/**
 * Returns true when there is not enough data to draw conclusions
 * (total conversations below C7 confidence floor of 50).
 */
export function isSparseMonth(summary: AttributionSummaryResponse): boolean {
  const total = summary.ecosystem?.total_conversations ?? 0;
  return total < 50;
}

// ---------------------------------------------------------------------------
// Lede (B1 + B4)
// ---------------------------------------------------------------------------

export interface LedeSlots {
  /** The rendered lede paragraph text — 3-4 sentences. */
  sentences: string[];
  /** Month display label. */
  monthLabel: string;
  /** Narrative variant applied. */
  variant: 'up' | 'down' | 'sparse' | 'empty';
}

/**
 * Generates the lede paragraph (3-4 sentences).
 *
 * B4 down-month rule: lead with the best true thing, state the dip plainly,
 * never spin. All clauses whose source is null are omitted (null-tolerant per spec).
 *
 * Returns no dollar signs anywhere — time is measured, not modeled (C7 §02).
 */
export function buildLede(summary: AttributionSummaryResponse): LedeSlots {
  const month = summary.month ?? '';
  const label = monthLabel(month);
  const totalConv = summary.ecosystem?.total_conversations ?? 0;
  const afterHours = summary.time?.after_hours_conversations;
  const leads = summary.funnel?.leads;
  const staffHours = summary.time?.staff_hours;
  const workWeeks = summary.time?.work_weeks;
  const channels = summary.ecosystem?.channels ?? [];
  const deltas = summary.deltas ?? {};
  const convDelta = deltas.conversations?.pct;
  const leadsDelta = deltas.leads?.pct;

  // Empty state
  if (totalConv === 0) {
    return {
      sentences: [
        `There are no conversations recorded for ${label} yet.`,
        'Check back once your first sessions come in.',
      ],
      monthLabel: label,
      variant: 'empty',
    };
  }

  // Sparse state (B4 — below confidence floor of 50)
  if (isSparseMonth(summary)) {
    return {
      sentences: [
        `In ${label}, MyRecruiter held ${fmt(totalConv)} conversation${totalConv === 1 ? '' : 's'} on your behalf.`,
        'This is an early month — there is not yet enough data to draw confident conclusions.',
        leads != null && leads > 0
          ? `${fmt(leads)} lead${leads === 1 ? ' was' : 's were'} delivered to your team.`
          : 'More data will build a complete picture next month.',
      ].filter(Boolean) as string[],
      monthLabel: label,
      variant: 'sparse',
    };
  }

  const best = bestRateChannel(channels);

  // Down-month variant (B4): lead with the best true thing, state dip plainly
  if (isDownMonth(summary)) {
    const sentences: string[] = [];

    // Best true thing first
    if (best) {
      const bestMeta: Record<string, string> = {
        website: 'your website widget',
        messenger: 'Messenger and Instagram',
        standalone: 'your QR codes and standalone links',
        campaign: 'your campaign links',
      };
      const bestName = bestMeta[best.channel] ?? best.channel;
      sentences.push(
        `${bestName} converted at ${pct(best.rate)} this month — your best channel by conversion rate.`,
      );
    } else {
      // No best channel — lead with leads delivered
      if (leads != null) {
        sentences.push(
          `MyRecruiter delivered ${fmt(leads)} lead${leads === 1 ? '' : 's'} to your team in ${label}.`,
        );
      }
    }

    // State the dip plainly
    if (convDelta != null && convDelta < 0 && leadsDelta != null && leadsDelta < 0) {
      sentences.push(
        `Conversations and leads were both down this month — ${Math.abs(convDelta).toFixed(0)}% and ${Math.abs(leadsDelta).toFixed(0)}% respectively compared to the prior period.`,
      );
    } else if (convDelta != null && convDelta < 0) {
      sentences.push(
        `Conversations were down ${Math.abs(convDelta).toFixed(0)}% from the prior period.`,
      );
    } else if (leadsDelta != null && leadsDelta < 0) {
      sentences.push(
        `Leads were down ${Math.abs(leadsDelta).toFixed(0)}% from the prior period.`,
      );
    }

    // Still add time coverage clause if present (null-tolerant: omit when null)
    if (staffHours != null && workWeeks != null) {
      sentences.push(
        `Even so, MyRecruiter absorbed ${fmtStaffHours(staffHours)} of conversation — ${fmtWorkWeeks(workWeeks)} of coverage your team never had to provide.`,
      );
    }

    return { sentences, monthLabel: label, variant: 'down' };
  }

  // Normal up-month variant
  const sentences: string[] = [];

  // Sentence 1: conversations + after-hours (null-tolerant: omit after-hours clause when null)
  if (afterHours != null) {
    sentences.push(
      `In ${label}, MyRecruiter held ${fmt(totalConv)} conversation${totalConv === 1 ? '' : 's'} on your behalf — ${fmt(afterHours)} of them after your office had closed for the day.`,
    );
  } else {
    sentences.push(
      `In ${label}, MyRecruiter held ${fmt(totalConv)} conversation${totalConv === 1 ? '' : 's'} on your behalf.`,
    );
  }

  // Sentence 2: leads + staff-hours (null-tolerant: omit work_weeks clause when null)
  if (leads != null && staffHours != null && workWeeks != null) {
    sentences.push(
      `Those conversations became ${fmt(leads)} lead${leads === 1 ? '' : 's'} delivered to your team, and absorbed ${fmtStaffHours(staffHours)} of conversation — ${fmtWorkWeeks(workWeeks)} of coverage you never had to hire.`,
    );
  } else if (leads != null) {
    sentences.push(
      `Those conversations became ${fmt(leads)} lead${leads === 1 ? '' : 's'} delivered to your team.`,
    );
  }

  // Sentence 3: best channel insight (null-tolerant: omit when no best channel)
  if (best) {
    const bestMeta: Record<string, string> = {
      website: 'the website widget',
      messenger: 'Messenger and Instagram',
      standalone: 'your QR codes and standalone links',
      campaign: 'campaign links',
    };
    const bestName = bestMeta[best.channel] ?? best.channel;
    sentences.push(
      `Your best investment this month: ${bestName} converted at ${pct(best.rate)} — the highest rate of any channel.`,
    );
  }

  return { sentences, monthLabel: label, variant: 'up' };
}

// ---------------------------------------------------------------------------
// Section 01 — What happened narrative
// ---------------------------------------------------------------------------

export interface WhatHappenedSlots {
  heading: string;
  body: string[];
}

export function buildWhatHappened(summary: AttributionSummaryResponse): WhatHappenedSlots {
  const funnel = summary.funnel ?? {};
  const channels = summary.ecosystem?.channels ?? [];
  const totalConv = funnel.conversations ?? 0;
  const engaged = funnel.engaged;
  const applications = funnel.applications;
  const leads = funnel.leads;

  if (totalConv === 0) {
    return {
      heading: 'No activity recorded yet.',
      body: ['Check back once conversations come in.'],
    };
  }

  const body: string[] = [];

  // Paragraph 1: funnel summary
  if (engaged != null && applications != null && leads != null) {
    body.push(
      `Of the ${fmt(totalConv)} people who started a conversation, ${fmt(engaged)} engaged deeply — ` +
      `they clicked a resource, explored a program, or went past surface questions. ` +
      `${fmt(applications)} began an application, and ${fmt(leads)} finished — completing the handoff to your team.`,
    );
  } else if (leads != null) {
    body.push(
      `Of the ${fmt(totalConv)} conversations, ${fmt(leads)} became lead${leads === 1 ? '' : 's'} delivered to your team.`,
    );
  }

  // Paragraph 2: best-performing topic or channel (null-tolerant)
  const bestByRate = channels
    .filter((c) => !c.rate_held && c.rate != null && (c.conversations ?? 0) >= 50)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  if (bestByRate.length > 0) {
    const best = bestByRate[0];
    const bestMeta: Record<string, string> = {
      website: 'Your website widget',
      messenger: 'Messenger and Instagram',
      standalone: 'Your QR codes and standalone links',
      campaign: 'Campaign links',
    };
    const name = bestMeta[best.channel] ?? best.channel;
    body.push(
      `${name} led on conversion this month at ${pct(best.rate)}.`,
    );
  }

  return {
    heading: 'People reached out. Most of them got what they came for.',
    body,
  };
}

// ---------------------------------------------------------------------------
// Section 02 — What it was worth
// ---------------------------------------------------------------------------

export interface WhatItWasWorthSlots {
  heading: string;
  /** Null-tolerant: omit this paragraph when self_booked_pct and median are both null. */
  responseParagraph: string | null;
  /** Confirmed-outcomes invitation (always rendered in v1 per mockup). */
  outcomesInvitation: string;
}

export function buildWhatItWasWorth(summary: AttributionSummaryResponse): WhatItWasWorthSlots {
  const time = summary.time ?? {};
  const selfBooked = time.self_booked_pct;
  const medianResponse = time.median_first_response_minutes;

  // Null-tolerant: build response paragraph only when at least one source is present
  let responseParagraph: string | null = null;
  if (selfBooked != null || medianResponse != null) {
    const parts: string[] = [];
    if (selfBooked != null) {
      parts.push(`${pct(selfBooked, 0)} of leads booked their own next step — zero wait on a human`);
    }
    if (medianResponse != null) {
      const hours = Math.round(medianResponse / 60);
      parts.push(
        `median first response for the rest: ${hours > 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : 'under an hour'}`,
      );
    }
    responseParagraph = parts.join('; ') + '.';
    // Capitalize
    responseParagraph = responseParagraph.charAt(0).toUpperCase() + responseParagraph.slice(1);
  }

  return {
    heading: "Your team never worked a night shift. Your mission did.",
    responseParagraph,
    outcomesInvitation:
      'When your team marks outcomes in the Lead Workspace ("became a volunteer", "donated"), ' +
      'this section will also report confirmed outcomes — not just deliveries.',
  };
}

// ---------------------------------------------------------------------------
// Section 04 — Channel interpretations (B1)
// ---------------------------------------------------------------------------

export interface ChannelInterpretation {
  channel: string;
  label: string;
  stat: string;
  /** One-sentence read. Below-floor channels get "too early to judge" phrasing. */
  read: string;
  /** Proportion of total conversations (0–100). */
  sharePct: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  website: 'Website widget',
  messenger: 'Messenger & Instagram',
  standalone: 'QR codes & standalone',
  campaign: 'Campaign links',
};

export function buildChannelInterpretations(
  channels: AttributionChannelEcosystem[],
): ChannelInterpretation[] {
  if (channels.length === 0) return [];

  // Sort by conversations descending
  const sorted = [...channels].sort(
    (a, b) => (b.conversations ?? 0) - (a.conversations ?? 0),
  );

  return sorted.map((ch) => {
    const label = CHANNEL_LABELS[ch.channel] ?? ch.channel;
    const conv = ch.conversations ?? 0;
    const leads = ch.leads ?? 0;
    const rate = ch.rate;
    const rateHeld = ch.rate_held ?? false;

    let stat: string;
    if (rateHeld) {
      stat = `${fmt(conv)} conversations — too early to judge`;
    } else if (rate != null) {
      stat = `${fmt(conv)} conversations · ${fmt(leads)} leads · ${pct(rate)} rate`;
    } else {
      stat = `${fmt(conv)} conversations · ${fmt(leads)} leads`;
    }

    let read: string;
    if (rateHeld || conv < 50) {
      read = 'Too early to judge — not enough data yet to draw conclusions about this channel.';
    } else if (rate != null && rate >= 20) {
      read = `Your most efficient channel this period — people coming here are already engaged before the first message.`;
    } else if (rate != null && rate >= 10) {
      read = `Solid and reliable — this channel is converting at a healthy rate.`;
    } else {
      read = `This channel is driving volume. Lower conversion is typical at this scale.`;
    }

    return {
      channel: ch.channel,
      label,
      stat,
      read,
      sharePct: ch.share_pct ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Section 05 — Recommendation cards from API rule pack (B1)
// ---------------------------------------------------------------------------

export interface RecommendationCard {
  tier: 'double_down' | 'worth_a_look' | 'too_early';
  heading: string;
  body: string;
  why: string;
}

const TIER_LABELS: Record<string, string> = {
  double_down: 'Double down',
  worth_a_look: 'Worth a look',
  too_early: 'Too early',
};

export function tierLabel(tier: string | null | undefined): string {
  return TIER_LABELS[tier ?? ''] ?? 'Hold';
}

/**
 * Converts C6 rule-pack outputs into briefing recommendation cards.
 * Text rendered verbatim (insight/read/suggested_move from API).
 * Tiers: Double down / Worth a look / Too early.
 * "Why we say this" evidence line rendered verbatim.
 */
export function buildRecommendationCards(
  adviceBoxes: AttributionAdviceBox[],
): RecommendationCard[] {
  return adviceBoxes
    .filter((box) => box.text)
    .map((box) => {
      const tier = (box.tier ?? 'too_early') as RecommendationCard['tier'];
      return {
        tier,
        heading: box.text ?? '',
        body: '', // text IS the heading in v1 (rule-pack text is concise)
        why: box.rule_id ?? '',
      };
    });
}

// ---------------------------------------------------------------------------
// Full briefing slots
// ---------------------------------------------------------------------------

export interface BriefingSlots {
  lede: LedeSlots;
  whatHappened: WhatHappenedSlots;
  whatItWasWorth: WhatItWasWorthSlots;
  channelInterpretations: ChannelInterpretation[];
}

export function buildBriefingSlots(summary: AttributionSummaryResponse): BriefingSlots {
  return {
    lede: buildLede(summary),
    whatHappened: buildWhatHappened(summary),
    whatItWasWorth: buildWhatItWasWorth(summary),
    channelInterpretations: buildChannelInterpretations(
      summary.ecosystem?.channels ?? [],
    ),
  };
}
