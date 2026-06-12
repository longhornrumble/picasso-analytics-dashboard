/**
 * OutcomesTable
 *
 * Per-channel share/conv/leads/rate table with swatch, held state rendering,
 * and totals row. Design ref: v5 mockup .outcomes table.
 * No dollars anywhere (locked decision #5).
 */

import type { AttributionChannelEcosystem } from '../../types/attribution';
import { getChannelMeta, CHANNEL_ORDER } from './channelMeta';
import type { AttributionChannel } from '../../types/attribution';

interface OutcomesTableProps {
  channels: AttributionChannelEcosystem[];
  month: string;
}

function formatRate(ch: AttributionChannelEcosystem): React.ReactNode {
  if (ch.rate_held) {
    return (
      <span className="text-slate-400 font-semibold" style={{ fontSize: '0.7rem' }}>
        held · n&lt;50
      </span>
    );
  }
  if (ch.rate == null) return <span className="text-slate-400">—</span>;
  const isHigh = (ch.rate ?? 0) >= 18;
  return (
    <span
      className={`font-extrabold`}
      style={{
        fontSize: '0.78rem',
        color: isHigh ? '#065f46' : '#0f172a',
      }}
    >
      {ch.rate.toFixed(1)}%
    </span>
  );
}

export function OutcomesTable({ channels, month }: OutcomesTableProps) {
  // Order channels canonically; absent channels don't render rows.
  const orderedChannels = CHANNEL_ORDER
    .map((ch) => channels.find((c) => c.channel === ch))
    .filter((c): c is AttributionChannelEcosystem => !!c);

  // Totals row: sum observable conversations and leads.
  const totalConv = orderedChannels.reduce((sum, c) => sum + (c.conversations ?? 0), 0);
  const totalLeads = orderedChannels.reduce((sum, c) => sum + (c.leads ?? 0), 0);
  const totalRate = totalConv > 0 ? (totalLeads / totalConv) * 100 : null;

  const monthLabel = (() => {
    try {
      const [y, m] = month.split('-');
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return month;
    }
  })();

  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th
            className="text-left text-slate-400 font-bold uppercase pb-2"
            style={{ fontSize: '0.6rem', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', paddingBottom: 7, paddingRight: 10 }}
          >
            Channel
          </th>
          {(['Share', 'Conv', 'Leads', 'Rate'] as const).map((h) => (
            <th
              key={h}
              className="text-right text-slate-400 font-bold uppercase"
              style={{ fontSize: '0.6rem', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', paddingBottom: 7, paddingRight: 10 }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orderedChannels.map((ch) => {
          const meta = getChannelMeta(ch.channel as AttributionChannel);
          return (
            <tr key={ch.channel}>
              <td
                className="font-bold"
                style={{ fontSize: '0.84rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
              >
                <span
                  className="inline-block rounded"
                  style={{ width: 11, height: 11, background: meta.color, marginRight: 9, verticalAlign: '-1px' }}
                  aria-hidden="true"
                />
                {meta.label}
              </td>
              <td
                className="text-right font-semibold text-slate-400"
                style={{ fontSize: '0.74rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
              >
                {ch.share_pct != null ? `${Math.round(ch.share_pct)}%` : '—'}
              </td>
              <td
                className="text-right font-bold"
                style={{ fontSize: '0.84rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
              >
                {(ch.conversations ?? 0).toLocaleString()}
              </td>
              <td
                className="text-right font-extrabold"
                style={{ fontSize: '0.84rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', color: '#047857', verticalAlign: 'middle' }}
              >
                {(ch.leads ?? 0).toLocaleString()}
              </td>
              <td
                className="text-right"
                style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
              >
                {formatRate(ch)}
              </td>
            </tr>
          );
        })}

        {/* Totals row */}
        <tr>
          <td
            className="text-slate-500"
            style={{ fontSize: '0.76rem', paddingTop: 12, paddingRight: 10, paddingBottom: 0 }}
          >
            {monthLabel} total
          </td>
          <td
            className="text-right text-slate-500"
            style={{ fontSize: '0.76rem', paddingTop: 12, paddingRight: 10 }}
          >
            100%
          </td>
          <td
            className="text-right font-extrabold text-slate-900"
            style={{ fontSize: '0.76rem', paddingTop: 12, paddingRight: 10 }}
          >
            {totalConv.toLocaleString()}
          </td>
          <td
            className="text-right font-extrabold text-slate-900"
            style={{ fontSize: '0.76rem', paddingTop: 12, paddingRight: 10 }}
          >
            {totalLeads.toLocaleString()}
          </td>
          <td
            className="text-right font-extrabold text-slate-900"
            style={{ fontSize: '0.76rem', paddingTop: 12, paddingRight: 10 }}
          >
            {totalRate != null ? `${totalRate.toFixed(1)}%` : '—'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
