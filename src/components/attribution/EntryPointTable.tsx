/**
 * EntryPointTable
 *
 * Entry points inside a channel expansion: provenance chips, minted date,
 * NEW/held tags. Design ref: v5 mockup table.drill section.
 * No per-person data — aggregates only (C8).
 */

import type { AttributionEntryPoint } from '../../types/attribution';

interface EntryPointTableProps {
  entryPoints: AttributionEntryPoint[];
  channel: string;
}

function ProvenanceTax({ ep, channel }: { ep: AttributionEntryPoint; channel: string }) {
  const tags: { label: string; highlight: boolean }[] = [];
  tags.push({ label: channel, highlight: true });
  if (ep.placement) tags.push({ label: ep.placement, highlight: false });
  if (ep.campaign) tags.push({ label: ep.campaign, highlight: false });

  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {tags.map((t, i) => (
        <span
          key={i}
          style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            borderRadius: 5,
            padding: '2px 7px',
            background: t.highlight ? '#ecfdf5' : '#f1f5f9',
            color: t.highlight ? '#047857' : '#64748b',
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function formatMinted(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function RateCell({ ep }: { ep: AttributionEntryPoint }) {
  if (ep.rate_held) {
    return (
      <td
        className="text-right"
        style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
      >
        <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
          small sample
        </span>
      </td>
    );
  }
  if (ep.rate == null) {
    return (
      <td
        className="text-right"
        style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', color: '#94a3b8' }}
      >
        —
      </td>
    );
  }
  return (
    <td
      className="text-right font-extrabold"
      style={{ fontSize: '0.76rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
    >
      {ep.rate.toFixed(1)}%
    </td>
  );
}

export function EntryPointTable({ entryPoints, channel }: EntryPointTableProps) {
  if (!entryPoints || entryPoints.length === 0) {
    return (
      <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No entry points yet for this channel.</p>
    );
  }

  return (
    <table
      className="w-full"
      style={{ borderCollapse: 'collapse' }}
      aria-label="Entry points in this channel"
    >
      <thead>
        <tr>
          {['Entry point', 'Minted', 'Conv', 'Leads', 'Rate'].map((h, i) => (
            <th
              key={h}
              className={i >= 2 ? 'text-right' : 'text-left'}
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#94a3b8',
                padding: '8px 10px 8px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entryPoints.map((ep, i) => {
          const isNew = ep.is_new;
          return (
            <tr key={ep.entry_point_id ?? i}>
              <td style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', maxWidth: 280 }}>
                <div className="font-bold" style={{ fontSize: '0.82rem' }}>
                  {ep.label ?? ep.entry_point_id ?? '—'}
                </div>
                <ProvenanceTax ep={ep} channel={channel} />
              </td>
              <td
                style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
              >
                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  {formatMinted(ep.created_at)}
                </span>
                {isNew && (
                  <span
                    style={{
                      fontSize: '0.56rem',
                      fontWeight: 800,
                      color: '#047857',
                      background: '#ecfdf5',
                      borderRadius: 5,
                      padding: '2px 6px',
                      marginLeft: 6,
                    }}
                    aria-label="New entry point"
                  >
                    NEW
                  </span>
                )}
              </td>
              <td
                className="text-right font-bold"
                style={{ fontSize: '0.82rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
              >
                {(ep.conversations ?? 0).toLocaleString()}
              </td>
              <td
                className="text-right font-extrabold"
                style={{ fontSize: '0.82rem', padding: '11px 10px 11px 0', borderBottom: '1px solid #f1f5f9', color: '#047857', verticalAlign: 'middle' }}
              >
                {(ep.leads ?? 0).toLocaleString()}
              </td>
              <RateCell ep={ep} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
