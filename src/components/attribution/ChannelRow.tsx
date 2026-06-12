/**
 * ChannelRow + ChannelExpansion
 *
 * Drill-in-place channel row. Collapsed: icon, name, share bar, conv/leads/rate,
 * sparkline. Expanded (in place): channel funnel strip, entry-points table,
 * topics list, resources list, 6-month TrendChart, AdviceBoxes.
 *
 * Design ref: v5 mockup .chrow, .expanded, .exp-body sections.
 * No master-detail / split-pane (locked decision).
 */

import { useState, useCallback } from 'react';
import type {
  AttributionChannelEcosystem,
  AttributionFunnel,
  AttributionEntryPoint,
  AttributionTopicCount,
  AttributionResourceClick,
  AttributionTrendPoint,
  AttributionAdviceBox,
  AttributionChannel,
} from '../../types/attribution';
import { getChannelMeta } from './channelMeta';
import { FunnelStrip } from './FunnelStrip';
import { EntryPointTable } from './EntryPointTable';
import { TrendChart } from './TrendChart';
import { AdviceBoxes } from './AdviceBoxes';

// ---------------------------------------------------------------------------
// Sparkline (inline SVG polyline)
// ---------------------------------------------------------------------------

interface SparklineProps {
  trend: AttributionTrendPoint[];
}

function Sparkline({ trend }: SparklineProps) {
  if (!trend || trend.length < 2) return null;
  const values = trend.slice(-6).map((t) => t.conversations ?? 0);
  const maxV = Math.max(...values, 1);
  const w = 84;
  const h = 26;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / maxV) * (h - 2)).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      className="flex-none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Channel icon
// ---------------------------------------------------------------------------

function ChannelIcon({ channel, expanded }: { channel: AttributionChannel | string; expanded: boolean }) {
  const meta = getChannelMeta(channel as AttributionChannel);
  return (
    <div
      className="flex-none flex items-center justify-center rounded-xl"
      style={{
        width: 40,
        height: 40,
        background: expanded ? '#d1fae5' : '#f1f5f9',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={expanded ? '#047857' : '#64748b'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 19, height: 19 }}
      >
        {meta.iconPaths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumStat (conv / leads / rate in header)
// ---------------------------------------------------------------------------

interface NumStatProps {
  value: string | number | null | undefined;
  label: string;
  highlight?: boolean;
}

function NumStat({ value, label, highlight }: NumStatProps) {
  return (
    <div className="text-right" style={{ minWidth: 70 }}>
      <span
        className="block font-extrabold"
        style={{
          fontSize: '1.2rem',
          letterSpacing: '-0.015em',
          color: highlight ? '#047857' : '#0f172a',
        }}
      >
        {value != null ? String(value) : '—'}
      </span>
      <span
        className="font-bold uppercase text-slate-400"
        style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChannelExpansion — rendered inside the card when expanded
// ---------------------------------------------------------------------------

interface ChannelExpansionProps {
  channel: AttributionChannel | string;
  funnel: AttributionFunnel | null | undefined;
  entryPoints: AttributionEntryPoint[] | null | undefined;
  topics: AttributionTopicCount[] | null | undefined;
  resources: AttributionResourceClick[] | null | undefined;
  trend: AttributionTrendPoint[] | null | undefined;
  read: AttributionAdviceBox | null | undefined;
  suggestedMove: AttributionAdviceBox | null | undefined;
  loading: boolean;
  error: string | null;
}

function ChannelExpansion({
  channel,
  funnel,
  entryPoints,
  topics,
  resources,
  trend,
  read,
  suggestedMove,
  loading,
  error,
}: ChannelExpansionProps) {
  const panelLabelStyle: React.CSSProperties = {
    fontSize: '0.64rem',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 9,
  };

  if (loading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-4 bg-slate-200 rounded w-64 mb-4" />
        <div className="h-20 bg-slate-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-slate-500" role="alert">
        Could not load channel detail: {error}
      </div>
    );
  }

  return (
    <>
      {/* Channel funnel strip */}
      {funnel && (
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <FunnelStrip funnel={funnel} compact />
        </div>
      )}

      {/* Expansion body */}
      <div style={{ padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Entry points table */}
        <div>
          <p style={panelLabelStyle}>
            {entryPoints && entryPoints.length > 0
              ? `The ${entryPoints.length} entry point${entryPoints.length !== 1 ? 's' : ''} inside this channel — each minted with its own provenance`
              : 'Entry points in this channel'}
          </p>
          <EntryPointTable entryPoints={entryPoints ?? []} channel={channel} />
        </div>

        {/* Topics + Chart side by side */}
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            {topics && topics.length > 0 && (
              <>
                <p style={panelLabelStyle}>What they asked about here</p>
                {(() => {
                  const maxCount = Math.max(...topics.map((t) => t.count ?? 0), 1);
                  return topics.map((t, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '7px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.78rem' }}>
                        <strong>{t.topic ?? '—'}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                          {(t.count ?? 0).toLocaleString()} conv
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', position: 'relative' }}>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: `${((t.count ?? 0) / maxCount) * 100}%`,
                            borderRadius: 999,
                            background: '#34d399',
                          }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </>
            )}

            {/* Resources */}
            {resources && resources.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={panelLabelStyle}>Most-clicked resources here</p>
                {resources.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      padding: '6px 0',
                      borderBottom: i < resources.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: '0.76rem',
                    }}
                  >
                    <strong>{r.url ?? '—'}</strong>
                    <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem' }}>
                      {(r.clicks ?? 0).toLocaleString()} clicks
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend chart */}
          <div>
            <p style={panelLabelStyle}>Six-month trajectory</p>
            <TrendChart trend={trend ?? []} />
          </div>
        </div>

        {/* Advice boxes */}
        {(read || suggestedMove) && (
          <AdviceBoxes read={read} suggestedMove={suggestedMove} />
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Mint affordance — disabled (N2) */}
          <button
            disabled
            title="Coming next increment"
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#94a3b8',
              background: 'none',
              border: 'none',
              cursor: 'not-allowed',
              padding: 0,
            }}
          >
            + Mint a new QR or link in this channel
          </button>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            rates shown per entry point; comparisons held until an entry point clears{' '}
            <strong style={{ color: '#475569' }}>50 conversations</strong>
          </span>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ChannelRow (public export)
// ---------------------------------------------------------------------------

interface ChannelRowProps {
  channelData: AttributionChannelEcosystem;
  onExpand: (channel: AttributionChannel) => Promise<{
    funnel?: AttributionFunnel | null;
    entryPoints?: AttributionEntryPoint[] | null;
    topics?: AttributionTopicCount[] | null;
    resources?: AttributionResourceClick[] | null;
    trend?: AttributionTrendPoint[] | null;
    read?: AttributionAdviceBox | null;
    suggested_move?: AttributionAdviceBox | null;
  } | null>;
  trendPoints?: AttributionTrendPoint[];
}

interface ExpandedDetail {
  funnel: AttributionFunnel | null;
  entryPoints: AttributionEntryPoint[] | null;
  topics: AttributionTopicCount[] | null;
  resources: AttributionResourceClick[] | null;
  trend: AttributionTrendPoint[] | null;
  read: AttributionAdviceBox | null;
  suggestedMove: AttributionAdviceBox | null;
}

export function ChannelRow({ channelData, onExpand, trendPoints }: ChannelRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ExpandedDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channel = channelData.channel as AttributionChannel;
  const meta = getChannelMeta(channel);

  const handleToggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail) return; // already loaded

    setLoading(true);
    setError(null);
    try {
      const data = await onExpand(channel);
      if (data) {
        setDetail({
          funnel: data.funnel ?? null,
          entryPoints: data.entryPoints ?? null,
          topics: data.topics ?? null,
          resources: data.resources ?? null,
          trend: data.trend ?? null,
          read: data.read ?? null,
          suggestedMove: data.suggested_move ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [expanded, detail, channel, onExpand]);

  const sharePct = channelData.share_pct ?? 0;

  const rateDisplay = (() => {
    if (channelData.rate_held) return '—';
    if (channelData.rate == null) return '—';
    return `${channelData.rate.toFixed(1)}%`;
  })();

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        border: expanded ? '1px solid #6ee7b7' : '1px solid #e2e8f0',
        boxShadow: expanded ? '0 4px 20px rgba(15,23,42,.07)' : '0 1px 2px rgba(15,23,42,.04)',
        transition: 'border-color 200ms, box-shadow 200ms',
      }}
    >
      {/* Row header — clickable */}
      <button
        className="w-full text-left"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={`channel-expansion-${channel}`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <div
          className="flex items-center"
          style={{ gap: 16, padding: '17px 24px 14px' }}
        >
          <ChannelIcon channel={channel} expanded={expanded} />

          <div className="flex-1 min-w-0">
            <div
              className="font-extrabold"
              style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}
            >
              {meta.label}
              {channelData.rate_held && (
                <span
                  className="font-extrabold uppercase text-slate-400 bg-slate-100 rounded"
                  style={{ fontSize: '0.6rem', letterSpacing: '0.06em', padding: '3px 8px', marginLeft: 8, verticalAlign: 2 }}
                  aria-label="new — comparisons held until n is at least 50"
                >
                  new — comparisons held until n &ge; 50
                </span>
              )}
            </div>
            <div className="text-slate-400" style={{ fontSize: '0.72rem', marginTop: 3 }}>
              {Math.round(sharePct)}% of all conversations
            </div>
          </div>

          <div className="flex items-center" style={{ gap: 26 }}>
            <NumStat value={(channelData.conversations ?? 0).toLocaleString()} label="conversations" />
            <NumStat value={(channelData.leads ?? 0).toLocaleString()} label="leads" highlight />
            <NumStat value={rateDisplay} label="rate" />
            {trendPoints && <Sparkline trend={trendPoints} />}
            <span
              className="flex-none text-center"
              style={{
                color: expanded ? '#059669' : '#cbd5e1',
                fontSize: '0.85rem',
                width: 14,
                transition: 'color 150ms',
              }}
              aria-hidden="true"
            >
              {expanded ? '▾' : '▸'}
            </span>
          </div>
        </div>
      </button>

      {/* Share bar */}
      <div style={{ height: 4, background: '#f1f5f9', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${sharePct}%`,
            background: expanded ? '#50C878' : '#a7f3d0',
            transition: 'background 200ms, width 400ms',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Expansion panel */}
      {expanded && (
        <div id={`channel-expansion-${channel}`} role="region" aria-label={`${meta.label} detail`}>
          <ChannelExpansion
            channel={channel}
            funnel={detail?.funnel}
            entryPoints={detail?.entryPoints}
            topics={detail?.topics}
            resources={detail?.resources}
            trend={detail?.trend}
            read={detail?.read}
            suggestedMove={detail?.suggestedMove}
            loading={loading}
            error={error}
          />
        </div>
      )}
    </div>
  );
}
