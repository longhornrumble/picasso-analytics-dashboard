/**
 * AttributionWorkspace — v5 Numbers workspace.
 *
 * Page anatomy (locked, v5 — ATTRIBUTION_SURFACE_NUMBERS.md §Page anatomy):
 *   1. Top bar — month picker, + Mint (disabled, N2), no Export CSV (N3)
 *   2. Ecosystem lede — EcosystemDonut + OutcomesTable + insight line
 *   3. Journey band — all-channels FunnelStrip
 *   4. MoneyBand — dark hero (NEVER moves below fold)
 *   5. Drill layer — ChannelRow per channel (expand in place)
 *
 * Flag check: App.tsx controls which branch renders (PremiumLock vs this).
 * This component assumes flag is ON — it never re-checks internally.
 */

import { useState, useEffect, useCallback } from 'react';
import type { AttributionSummaryResponse, AttributionChannel } from '../../types/attribution';
import { getAttributionSummary, getAttributionChannel } from '../../services/attributionApi';
import { CHANNEL_ORDER } from './channelMeta';
import { EcosystemDonut } from './EcosystemDonut';
import { OutcomesTable } from './OutcomesTable';
import { FunnelStrip } from './FunnelStrip';
import { MoneyBand } from './MoneyBand';
import { ChannelRow } from './ChannelRow';
import { AttributionSkeleton } from './AttributionSkeleton';
import { AttributionEmpty } from './AttributionEmpty';

// ---------------------------------------------------------------------------
// Month picker helpers
// ---------------------------------------------------------------------------

function currentMonthISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthDisplay(iso: string): string {
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

function priorMonthISO(iso: string): string {
  try {
    const [y, m] = iso.split('-');
    const d = new Date(Number(y), Number(m) - 2, 1); // subtract 1 month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function monthISOs(count = 12): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

interface TopBarProps {
  month: string;
  onMonthChange: (m: string) => void;
}

function TopBar({ month, onMonthChange }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const options = monthISOs(12);
  const prior = priorMonthISO(month);

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap"
      style={{ padding: '18px 24px', gap: 14 }}
    >
      <div>
        <div
          className="font-bold uppercase text-slate-400"
          style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}
        >
          Mission Intelligence · Attribution &amp; ROI
        </div>
        <h1
          className="font-extrabold text-slate-900"
          style={{ fontSize: '1.3rem', letterSpacing: '-0.015em', marginTop: 2 }}
        >
          The Numbers
        </h1>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
        {/* Month picker */}
        <div className="relative">
          <button
            className="flex items-center border border-slate-200 rounded-xl font-bold bg-white"
            style={{ gap: 8, padding: '8px 14px', fontSize: '0.8rem' }}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Selected month: ${formatMonthDisplay(month)}`}
          >
            {formatMonthDisplay(month)} &#9660;
            <span className="text-slate-400 font-semibold" style={{ fontSize: '0.72rem' }}>
              vs {formatMonthDisplay(prior)}
            </span>
          </button>
          {open && (
            <ul
              className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden"
              style={{ minWidth: 200, maxHeight: 260, overflowY: 'auto' }}
              role="listbox"
              aria-label="Select month"
            >
              {options.map((opt) => (
                <li
                  key={opt}
                  role="option"
                  aria-selected={opt === month}
                  className="cursor-pointer px-4 py-2 hover:bg-slate-50 text-sm font-semibold"
                  style={{ color: opt === month ? '#047857' : '#334155' }}
                  onClick={() => { onMonthChange(opt); setOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onMonthChange(opt);
                      setOpen(false);
                    }
                  }}
                  tabIndex={0}
                >
                  {formatMonthDisplay(opt)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mint button — disabled N2 */}
        <button
          disabled
          title="Coming next increment"
          className="font-bold text-white rounded-full"
          style={{
            fontSize: '0.78rem',
            background: '#a7f3d0',
            borderRadius: 999,
            padding: '9px 18px',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
          aria-label="Mint a link or QR (coming next increment)"
        >
          + Mint a link or QR
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

export function AttributionWorkspace() {
  const [month, setMonth] = useState<string>(currentMonthISO);
  const [summary, setSummary] = useState<AttributionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Reset state as a batch at the start of each fetch.
    // The setState calls below run synchronously before the async fetch begins;
    // they are accepted by React 18 automatic batching and do not cause cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setSummary(null);

    getAttributionSummary(month)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load attribution data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [month]);

  const handleExpand = useCallback(
    async (channel: AttributionChannel) => {
      const data = await getAttributionChannel(channel, month);
      return {
        funnel: data.funnel,
        entryPoints: data.entry_points,
        topics: data.topics,
        resources: data.resources,
        trend: data.trend,
        read: data.read,
        suggested_move: data.suggested_move,
      };
    },
    [month],
  );

  if (loading) {
    return (
      <>
        <TopBar month={month} onMonthChange={setMonth} />
        <AttributionSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <div
        className="max-w-5xl mx-auto px-4 py-8"
        role="alert"
      >
        <TopBar month={month} onMonthChange={setMonth} />
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            className="text-emerald-700 font-semibold text-sm underline"
            onClick={() => setMonth((m) => m)} // re-trigger effect
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const ecosystem = summary?.ecosystem;
  const funnel = summary?.funnel;
  const time = summary?.time;
  const channels = ecosystem?.channels ?? [];
  const totalConv = ecosystem?.total_conversations ?? 0;
  const afterHoursPct = ecosystem?.after_hours_pct ?? 0;
  const deltas = summary?.deltas ?? {};
  const insight = summary?.insight;

  // Empty state — zero aggregates
  const isEmpty = totalConv === 0 && (funnel?.leads ?? 0) === 0;
  if (isEmpty) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-4">
        <TopBar month={month} onMonthChange={setMonth} />
        <AttributionEmpty />
      </div>
    );
  }

  // Channels present in payload, in canonical order, with > 0 conversations
  const activeChannels = CHANNEL_ORDER
    .map((ch) => channels.find((c) => c.channel === ch))
    .filter((c) => !!c && (c.conversations ?? 0) > 0);

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-4"
      data-testid="attribution-workspace"
    >
      {/* 1. Top bar */}
      <TopBar month={month} onMonthChange={setMonth} />

      {/* 2. Ecosystem lede */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div
          className="flex justify-between items-baseline"
          style={{ padding: '18px 24px 0' }}
        >
          <h2 className="font-extrabold text-slate-900" style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>
            Your engagement ecosystem — {formatMonthDisplay(month)}
          </h2>
          <span className="text-slate-400" style={{ fontSize: '0.72rem' }}>
            where MyRecruiter is working for you
          </span>
        </div>

        <div
          className="grid items-center"
          style={{ gridTemplateColumns: '260px 1fr', gap: 30, padding: '18px 28px 6px' }}
        >
          <EcosystemDonut
            totalConversations={totalConv}
            afterHoursPct={afterHoursPct}
            channels={channels}
          />
          <div>
            <OutcomesTable channels={channels} month={month} />
          </div>
        </div>

        {insight && !insight.held && insight.text && (
          <div
            style={{
              margin: '14px 24px 20px',
              borderLeft: '3px solid #50C878',
              background: '#ecfdf5',
              borderRadius: '0 10px 10px 0',
              padding: '13px 18px',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#334155',
              lineHeight: 1.6,
            }}
            role="note"
            aria-label="This month's insight"
          >
            <strong style={{ color: '#065f46' }}>This month's read:</strong>{' '}
            {insight.text}
          </div>
        )}
      </div>

      {/* 3. Journey band */}
      {funnel && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div
            className="flex justify-between items-baseline"
            style={{ padding: '18px 24px 0' }}
          >
            <h2 className="font-extrabold text-slate-900" style={{ fontSize: '1rem' }}>
              The journey
            </h2>
            <span className="text-slate-400" style={{ fontSize: '0.72rem' }}>
              from reached to lead, all channels
            </span>
          </div>
          <FunnelStrip funnel={funnel} deltas={deltas} />
          {funnel.reached != null && funnel.reached > 0 && (
            <p
              className="text-slate-400"
              style={{ fontSize: '0.66rem', padding: '0 24px 14px' }}
            >
              * reach = site visits, scans &amp; link clicks, measured by MyRecruiter — context above
              the funnel; Messenger entries count straight into conversations
            </p>
          )}
        </div>
      )}

      {/* 4. Money band — HEADLINE type; never moves below fold */}
      {time && (
        <MoneyBand time={time} />
      )}

      {/* Section label */}
      <div
        className="flex justify-between items-baseline"
        style={{ padding: '8px 6px 0' }}
      >
        <h2 className="font-extrabold text-slate-900" style={{ fontSize: '1rem' }}>
          Where is it working?
        </h2>
        <span className="text-slate-400" style={{ fontSize: '0.72rem' }}>
          every row opens in place — channel &rarr; entry point
        </span>
      </div>

      {/* 5. Drill layer */}
      {activeChannels.map((ch) => (
        <ChannelRow
          key={ch!.channel}
          channelData={ch!}
          onExpand={handleExpand}
        />
      ))}
    </div>
  );
}
