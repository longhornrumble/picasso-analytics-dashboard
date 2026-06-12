/**
 * FunnelStrip — scope-agnostic funnel component.
 *
 * Used at three scopes: page (all-channels), channel, entry-point.
 * Design ref: v5 mockup .funnel-strip, .fs-chip, .fs-rate.
 * "reached" chip is dashed/context. "leads" chip is final (emerald).
 * Rate end-cap. Deltas from the `deltas` prop (YYYY-MM keys in summary,
 * or inline delta strings passed per chip).
 *
 * All props optional-tolerant — renders gracefully from empty/partial data.
 */

import type { AttributionFunnel, AttributionDelta } from '../../types/attribution';

interface FunnelStripProps {
  funnel: AttributionFunnel;
  /** Deltas keyed by metric name, e.g. "conversations", "leads", "rate" */
  deltas?: Record<string, AttributionDelta> | null;
  /** Smaller chip variant (used inside ChannelExpansion) */
  compact?: boolean;
}

function formatDelta(delta: AttributionDelta | null | undefined): React.ReactNode {
  if (!delta || delta.pct == null) return null;
  const sign = delta.pct >= 0 ? '▲ ' : '▼ ';
  const color = delta.pct >= 0 ? '#059669' : '#ef4444';
  return (
    <em
      style={{ fontStyle: 'normal', fontSize: '0.7rem', color, fontWeight: 800, marginLeft: 5 }}
      aria-label={`${delta.pct >= 0 ? 'up' : 'down'} ${Math.abs(delta.pct).toFixed(0)}%`}
    >
      {sign}{Math.abs(delta.pct).toFixed(0)}%
    </em>
  );
}

interface ChipProps {
  value: number | null | undefined;
  label: string;
  variant?: 'default' | 'context' | 'final';
  delta?: AttributionDelta | null;
  compact?: boolean;
}

function Chip({ value, label, variant = 'default', delta, compact }: ChipProps) {
  const isContext = variant === 'context';
  const isFinal = variant === 'final';

  const chipStyle: React.CSSProperties = {
    background: isFinal ? '#ecfdf5' : isContext ? '#f8fafc' : '#fff',
    border: `1px ${isContext ? 'dashed' : 'solid'} ${isFinal ? '#a7f3d0' : '#e2e8f0'}`,
    borderRadius: 11,
    padding: compact ? '8px 15px' : '10px 18px',
  };

  const valueStyle: React.CSSProperties = {
    display: 'block',
    fontSize: compact ? '1.2rem' : '1.45rem',
    fontWeight: 800,
    letterSpacing: '-0.015em',
    color: isFinal ? '#065f46' : isContext ? '#64748b' : '#0f172a',
    lineHeight: 1,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={chipStyle}>
      <span style={valueStyle}>
        {value != null && !isNaN(value) ? value.toLocaleString() : '—'}
        {delta && formatDelta(delta)}
      </span>
      <span style={labelStyle}>{label}</span>
    </div>
  );
}

const Arrow = () => (
  <span
    className="text-slate-300 font-bold flex-none"
    aria-hidden="true"
  >
    &rarr;
  </span>
);

export function FunnelStrip({ funnel, deltas, compact }: FunnelStripProps) {
  const hasReached = funnel.reached != null && funnel.reached > 0;

  const rateValue = funnel.rate;
  const rateDelta = deltas?.rate;

  return (
    <div
      className="flex items-center flex-wrap"
      style={{ gap: 10, padding: compact ? '13px 24px' : '16px 24px 12px' }}
      role="list"
      aria-label="Conversion funnel stages"
    >
      {hasReached && (
        <>
          <div role="listitem">
            <Chip
              value={funnel.reached}
              label="reached *"
              variant="context"
              compact={compact}
            />
          </div>
          <Arrow />
        </>
      )}
      <div role="listitem">
        <Chip
          value={funnel.conversations}
          label="conversations"
          delta={deltas?.conversations}
          compact={compact}
        />
      </div>
      <Arrow />
      <div role="listitem">
        <Chip value={funnel.engaged} label="engaged" compact={compact} />
      </div>
      <Arrow />
      <div role="listitem">
        <Chip value={funnel.applications} label="applications" compact={compact} />
      </div>
      <Arrow />
      <div role="listitem">
        <Chip
          value={funnel.leads}
          label="leads delivered"
          variant="final"
          delta={deltas?.leads}
          compact={compact}
        />
      </div>

      {/* Rate end-cap */}
      {rateValue != null && (
        <div
          className="ml-auto text-right"
          aria-label={`Conversion rate: ${rateValue.toFixed(1)}%`}
        >
          <span
            className="block font-extrabold"
            style={{
              fontSize: compact ? '1.3rem' : '1.5rem',
              color: '#047857',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            {rateValue.toFixed(1)}%
            {rateDelta && formatDelta(rateDelta)}
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            conversation &rarr; lead
          </span>
        </div>
      )}
    </div>
  );
}
