/**
 * AttributionBriefing — B1 briefing view for the Attribution tab.
 *
 * Document anatomy (v2.1, ATTRIBUTION_SURFACE_BRIEFING.md):
 *   Masthead → Lede → §01 What happened (FunnelStrip) → §02 What it was worth
 *   (time-strip) → §03 One story (aggregate-only fallback, B2 placeholder)
 *   → §04 Where they came from → §05 What to do next → Epistemic footer.
 *
 * Data: same getAttributionSummary + getAttributionChannel payloads as Numbers.
 * NO new endpoints (B1 spec).
 *
 * Narrative: deterministic templates — no LLM (B1 spec). See briefingNarrative.ts.
 *
 * B3 — board PDF export: "Export for your board packet" triggers window.print().
 *   Print stylesheet class "briefing-print" is applied on the root element to
 *   activate the @media print rules in index.css (tab chrome hidden, sections
 *   paginate, dated header, epistemic footer).
 *
 * Deep links (credibility mechanism): load-bearing figures in §01/§04 are
 *   clickable. Deep-link triggers onDeepLink(section, channel?) which the
 *   container uses to switch to Numbers view and scroll to the matching section.
 *
 * §03 renders the aggregate-only fallback for now. Per-session exemplar endpoint
 *   does not exist and is PII-gated — see B2 for the full spec.
 *   TODO(B2): replace with per-session exemplar journey when B2 lands.
 */

import type { AttributionSummaryResponse, AttributionAdviceBox } from '../../types/attribution';
import { FunnelStrip } from './FunnelStrip';
import {
  buildBriefingSlots,
  buildRecommendationCards,
  tierLabel,
} from './briefingNarrative';
import type { AttributionChannel } from '../../types/attribution';

// ---------------------------------------------------------------------------
// Print handler (B3)
// ---------------------------------------------------------------------------

function handlePrint() {
  window.print();
}

// ---------------------------------------------------------------------------
// Masthead
// ---------------------------------------------------------------------------

interface MastheadProps {
  monthLabel: string;
  tenantName?: string;
  channelCount: number;
  onSwitchToNumbers: () => void;
}

function Masthead({ monthLabel, tenantName, channelCount, onSwitchToNumbers }: MastheadProps) {
  return (
    <div
      className="briefing-masthead"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 20,
        paddingBottom: 26,
        borderBottom: '2px solid #0f172a',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#059669',
          }}
        >
          Mission Intelligence
          {tenantName ? ` · Prepared for ${tenantName}` : ''}
        </div>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginTop: 6,
            color: '#0f172a',
          }}
        >
          Your {monthLabel} Briefing
        </h1>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
          From your AI team member · {channelCount} channel{channelCount !== 1 ? 's' : ''} measured
        </div>
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0, paddingTop: 4 }}
        className="briefing-actions"
      >
        <button
          onClick={handlePrint}
          style={{
            background: '#50C878',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.82rem',
            borderRadius: 999,
            padding: '11px 22px',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 16px rgba(80,200,120,.3)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Export briefing for board packet (opens print dialog)"
        >
          Export for your board packet
        </button>
        <button
          onClick={onSwitchToNumbers}
          style={{
            fontSize: '0.74rem',
            fontWeight: 600,
            color: '#64748b',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Switch to numbers charts view"
        >
          prefer charts?{' '}
          <strong style={{ color: '#059669' }}>open the numbers →</strong>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section eyebrow helper
// ---------------------------------------------------------------------------

function SecEyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '0.66rem',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#94a3b8',
        marginBottom: 8,
      }}
    >
      <span style={{ color: '#059669' }}>{num}</span>
      {label}
      <span
        style={{ flex: 1, height: 1, background: '#e2e8f0' }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// §02 Time-strip (briefing-styled variant of MoneyBand)
// ---------------------------------------------------------------------------

interface TimeStripProps {
  afterHoursConversations: number | null | undefined;
  staffHours: number | null | undefined;
  workWeeks: number | null | undefined;
}

function TimeStrip({ afterHoursConversations, staffHours, workWeeks }: TimeStripProps) {
  const ww =
    workWeeks != null && !isNaN(workWeeks)
      ? workWeeks < 1
        ? '< 1 week'
        : `${workWeeks.toFixed(1)} weeks`
      : '—';

  const sh =
    staffHours != null && !isNaN(staffHours) ? `~${Math.round(staffHours)} hrs` : '—';

  return (
    <div
      className="briefing-time-strip"
      style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}
      role="region"
      aria-label="After-hours coverage summary"
    >
      {/* Hero cell */}
      <div
        style={{
          flex: 1,
          padding: '16px 18px',
          background: '#065f46',
          borderRight: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <strong
          style={{
            display: 'block',
            fontSize: '1.35rem',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: '#fff',
          }}
        >
          {afterHoursConversations != null && !isNaN(afterHoursConversations)
            ? afterHoursConversations.toLocaleString()
            : '—'}
        </strong>
        <span style={{ fontSize: '0.74rem', color: '#a7f3d0', lineHeight: 1.45, display: 'block', marginTop: 3 }}>
          conversations held while your office was closed — nights, weekends, 11 PMs
        </span>
      </div>

      <div
        style={{ flex: 1, padding: '16px 18px', borderRight: '1px solid #f1f5f9' }}
      >
        <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#0f172a' }}>
          {sh}
        </strong>
        <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.45, display: 'block', marginTop: 3 }}>
          of conversations your team never had to take — staff-hours you didn&apos;t hire for
        </span>
      </div>

      <div style={{ flex: 1, padding: '16px 18px' }}>
        <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#0f172a' }}>
          {ww}
        </strong>
        <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.45, display: 'block', marginTop: 3 }}>
          of full-time coverage, absorbed by your AI team member this month
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §04 Channel row
// ---------------------------------------------------------------------------

interface ChannelBriefingRowProps {
  channelKey: string;
  label: string;
  stat: string;
  read: string;
  sharePct: number;
  onDeepLink?: (channel: AttributionChannel) => void;
}

function ChannelBriefingRow({
  channelKey,
  label,
  stat,
  read,
  sharePct,
  onDeepLink,
}: ChannelBriefingRowProps) {
  const isValidChannel = (ch: string): ch is AttributionChannel =>
    ['website', 'messenger', 'standalone', 'campaign'].includes(ch);

  return (
    <div
      style={{ padding: '13px 0', borderBottom: '1px solid #f1f5f9' }}
      data-testid={`briefing-channel-row-${channelKey}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
          {onDeepLink && isValidChannel(channelKey) ? (
            <button
              onClick={() => onDeepLink(channelKey)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#047857',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
              }}
              aria-label={`Deep link to ${label} in Numbers view`}
              title="Open in Numbers view"
            >
              {label}
            </button>
          ) : (
            label
          )}
        </span>
        <span style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{stat}</span>
      </div>
      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>{read}</div>
      <div
        style={{ height: 4, borderRadius: 999, background: '#f1f5f9', marginTop: 8, position: 'relative' }}
        role="img"
        aria-label={`${label}: ${sharePct.toFixed(0)}% of conversations`}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.min(100, Math.max(0, sharePct))}%`,
            background: '#50C878',
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §05 Recommendation card
// ---------------------------------------------------------------------------

interface RecCardProps {
  tier: 'double_down' | 'worth_a_look' | 'too_early';
  heading: string;
  why: string;
}

const TIER_STYLES: Record<string, React.CSSProperties> = {
  double_down: {
    border: '1px solid #a7f3d0',
    background: 'linear-gradient(180deg,#fff 30%, #ecfdf5)',
  },
  worth_a_look: {
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  too_early: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
};

const TIER_TAG_STYLES: Record<string, React.CSSProperties> = {
  double_down: { background: '#d1fae5', color: '#065f46' },
  worth_a_look: { background: '#fef3c7', color: '#92400e' },
  too_early: { background: '#f1f5f9', color: '#64748b' },
};

function RecCard({ tier, heading, why }: RecCardProps) {
  const label = tierLabel(tier);
  return (
    <div
      style={{
        ...TIER_STYLES[tier],
        borderRadius: 12,
        padding: '16px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      data-testid={`briefing-rec-card-${tier}`}
    >
      <span
        style={{
          ...TIER_TAG_STYLES[tier],
          fontSize: '0.6rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderRadius: 999,
          padding: '3px 10px',
          alignSelf: 'flex-start',
        }}
      >
        {label}
      </span>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.35, color: '#0f172a' }}>
        {heading}
      </h3>
      {why && (
        <div
          style={{
            fontSize: '0.68rem',
            color: '#94a3b8',
            borderTop: '1px solid #f1f5f9',
            paddingTop: 8,
            marginTop: 'auto',
          }}
        >
          <strong style={{ color: '#64748b' }}>Why we say this:</strong> {why}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Epistemic footer
// ---------------------------------------------------------------------------

function EpistemicFooter({ month }: { month: string }) {
  return (
    <footer
      className="briefing-epistemic"
      style={{
        marginTop: 34,
        borderTop: '2px solid #0f172a',
        paddingTop: 16,
        fontSize: '0.76rem',
        color: '#64748b',
        lineHeight: 1.65,
      }}
      aria-label="Epistemic note — how to read this briefing"
    >
      <strong style={{ color: '#334155' }}>How to read this briefing:</strong>{' '}
      every number here is something MyRecruiter directly witnessed — a conversation it held, a
      question it answered, an application it collected, a booking it made. We don&apos;t claim
      credit for things we can&apos;t see, and we don&apos;t guess: there are no estimated
      dollars in this briefing —{' '}
      <strong style={{ color: '#334155' }}>time is measured, not modeled</strong> — and
      recommendations are held back until the sample size can support them. When your team
      confirms outcomes in the Lead Workspace, deliveries become confirmed outcomes.
      <div
        style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', paddingTop: 22 }}
        aria-hidden="true"
      >
        MyRecruiter Mission Intelligence · {month} · all figures directly measured
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface AttributionBriefingProps {
  summary: AttributionSummaryResponse;
  /** Advice boxes from the server-side rule pack (C6 — same source as Numbers). */
  adviceBoxes?: AttributionAdviceBox[];
  /** Switches the container to Numbers view. */
  onSwitchToNumbers: () => void;
  /** Deep-link: navigate Numbers view to a specific channel. */
  onDeepLinkChannel?: (channel: AttributionChannel) => void;
  /** Optional tenant display name for masthead. */
  tenantName?: string;
}

export function AttributionBriefing({
  summary,
  adviceBoxes = [],
  onSwitchToNumbers,
  onDeepLinkChannel,
  tenantName,
}: AttributionBriefingProps) {
  const slots = buildBriefingSlots(summary);
  const recs = buildRecommendationCards(adviceBoxes);
  const funnel = summary.funnel ?? {};
  const time = summary.time ?? {};
  const deltas = summary.deltas ?? {};
  const channelCount = (summary.ecosystem?.channels ?? []).filter(
    (c) => (c.conversations ?? 0) > 0,
  ).length;

  return (
    <div
      className="briefing-root"
      data-testid="attribution-briefing"
      style={{ maxWidth: 780, margin: '0 auto', fontFamily: 'inherit' }}
    >
      {/* Masthead */}
      <Masthead
        monthLabel={slots.lede.monthLabel}
        tenantName={tenantName}
        channelCount={channelCount}
        onSwitchToNumbers={onSwitchToNumbers}
      />

      {/* Lede */}
      <div
        className="briefing-lede"
        style={{
          padding: '34px 0 8px',
          fontSize: '1.1rem',
          lineHeight: 1.75,
          color: '#334155',
          fontWeight: 500,
        }}
        data-testid="briefing-lede"
      >
        {slots.lede.sentences.map((s, i) => (
          <span key={i}>
            {i > 0 && ' '}
            {s}
          </span>
        ))}
      </div>

      {/* §01 What happened */}
      <section
        style={{ padding: '30px 0 6px' }}
        aria-labelledby="briefing-s01-heading"
        data-testid="briefing-section-01"
      >
        <SecEyebrow num="01" label="What happened" />
        <h2
          id="briefing-s01-heading"
          style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 10px', color: '#0f172a' }}
        >
          {slots.whatHappened.heading}
        </h2>
        {slots.whatHappened.body.map((p, i) => (
          <p
            key={i}
            style={{ fontSize: '0.95rem', color: '#475569', marginBottom: 12, lineHeight: 1.7 }}
          >
            {p}
          </p>
        ))}

        {/* Funnel strip — reused from Numbers (B1 spec: reuse components). */}
        {/* Deep link: funnel conversations → Numbers view (credibility mechanism). */}
        <div data-testid="briefing-funnel-strip">
          <FunnelStrip funnel={funnel} deltas={deltas} />
        </div>
        {funnel.reached != null && funnel.reached > 0 && (
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', padding: '0 0 8px' }}>
            * reach = site visits, scans &amp; link clicks measured by MyRecruiter
          </p>
        )}
      </section>

      {/* §02 What it was worth */}
      <section
        style={{ padding: '30px 0 6px' }}
        aria-labelledby="briefing-s02-heading"
        data-testid="briefing-section-02"
      >
        <SecEyebrow num="02" label="What it was worth" />
        <h2
          id="briefing-s02-heading"
          style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 14px', color: '#0f172a' }}
        >
          {slots.whatItWasWorth.heading}
        </h2>

        {/* Briefing-styled time-strip — variant of MoneyBand. */}
        <TimeStrip
          afterHoursConversations={time.after_hours_conversations}
          staffHours={time.staff_hours}
          workWeeks={time.work_weeks}
        />

        {/* Response paragraph — null-tolerant: rendered only when source is present. */}
        {slots.whatItWasWorth.responseParagraph && (
          <p style={{ fontSize: '0.95rem', color: '#475569', marginTop: 14, lineHeight: 1.7 }}>
            {slots.whatItWasWorth.responseParagraph}
          </p>
        )}

        {/* Outcomes invitation — always rendered in v1 */}
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          {slots.whatItWasWorth.outcomesInvitation}
        </p>
      </section>

      {/* §03 One story — aggregate-only fallback (B2 placeholder).
          Per-session exemplar endpoint does not exist and is PII-gated.
          TODO(B2): replace with per-session exemplar journey when B2 lands.
          pii-data-lifecycle-advisor sign-off required before any per-session data renders here. */}
      <section
        style={{ padding: '30px 0 6px' }}
        aria-labelledby="briefing-s03-heading"
        data-testid="briefing-section-03"
      >
        <SecEyebrow num="03" label="One story from this month" />
        <h2
          id="briefing-s03-heading"
          style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 10px', color: '#0f172a' }}
        >
          The aggregate picture, this month.
        </h2>
        <div
          style={{
            borderLeft: '3px solid #50C878',
            background: '#ecfdf5',
            borderRadius: '0 12px 12px 0',
            padding: '18px 22px 14px',
            marginBottom: 8,
          }}
          data-testid="briefing-section-03-fallback"
          aria-label="Aggregate story — anonymized"
        >
          <div
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#059669',
              marginBottom: 10,
            }}
          >
            Aggregate summary — no individual session data
          </div>
          <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.65, marginBottom: 10 }}>
            {slots.lede.variant !== 'empty' && slots.lede.variant !== 'sparse' ? (
              <>
                This month{' '}
                <strong>
                  {(summary.funnel?.leads ?? 0).toLocaleString()} lead
                  {(summary.funnel?.leads ?? 0) !== 1 ? 's' : ''}
                </strong>{' '}
                were delivered. The typical journey: a question, a resource click, a
                completed application — and a handoff to your team, often while your
                office was closed.
              </>
            ) : (
              'Individual journey stories will appear here once there is enough activity.'
            )}
          </p>
          <p
            style={{
              fontSize: '0.82rem',
              color: '#065f46',
              fontWeight: 700,
              borderTop: '1px solid #a7f3d0',
              paddingTop: 10,
            }}
          >
            Human staff time spent: zero — until the handshake.
          </p>
        </div>
      </section>

      {/* §04 Where they came from */}
      {slots.channelInterpretations.length > 0 && (
        <section
          style={{ padding: '30px 0 6px' }}
          aria-labelledby="briefing-s04-heading"
          data-testid="briefing-section-04"
        >
          <SecEyebrow num="04" label="Where they came from" />
          <h2
            id="briefing-s04-heading"
            style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 4px', color: '#0f172a' }}
          >
            Channels ranked by volume, with a one-line read.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {slots.channelInterpretations.map((ch) => (
              <ChannelBriefingRow
                key={ch.channel}
                channelKey={ch.channel}
                label={ch.label}
                stat={ch.stat}
                read={ch.read}
                sharePct={ch.sharePct}
                onDeepLink={onDeepLinkChannel}
              />
            ))}
          </div>
        </section>
      )}

      {/* §05 What to do next */}
      {recs.length > 0 && (
        <section
          style={{ padding: '30px 0 6px' }}
          aria-labelledby="briefing-s05-heading"
          data-testid="briefing-section-05"
        >
          <SecEyebrow num="05" label="What to do next" />
          <h2
            id="briefing-s05-heading"
            style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 10px', color: '#0f172a' }}
          >
            {recs.length === 1 ? 'One move, in order of confidence.' : `${recs.length === 2 ? 'Two' : 'Three'} moves, in order of confidence.`}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(recs.length, 3)}, 1fr)`,
              gap: 12,
            }}
          >
            {recs.slice(0, 3).map((rec, i) => (
              <RecCard key={i} tier={rec.tier} heading={rec.heading} why={rec.why} />
            ))}
          </div>
        </section>
      )}

      {/* Epistemic footer */}
      <EpistemicFooter month={slots.lede.monthLabel} />
    </div>
  );
}
