/**
 * EcosystemDonut
 *
 * SVG donut chart — channel share segments, center = total conversations +
 * after-hours %. All data optional-tolerant (old/empty aggregates safe).
 *
 * Design ref: v5 mockup .donut-wrap section.
 * r=85, circumference=534.07
 */

import type { AttributionChannelEcosystem } from '../../types/attribution';
import { getChannelMeta, CHANNEL_ORDER } from './channelMeta';
import type { AttributionChannel } from '../../types/attribution';

interface EcosystemDonutProps {
  totalConversations: number;
  afterHoursPct: number;
  channels: AttributionChannelEcosystem[];
}

const RADIUS = 85;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 534.07

export function EcosystemDonut({ totalConversations, afterHoursPct, channels }: EcosystemDonutProps) {
  // Build segment list in CHANNEL_ORDER; channels absent from payload simply don't render.
  const orderedChannels = CHANNEL_ORDER
    .map((ch) => channels.find((c) => c.channel === ch))
    .filter((c): c is AttributionChannelEcosystem => !!c && (c.conversations ?? 0) > 0);

  // Compute dasharray/dashoffset for each segment via reduce (immutable accumulator).
  // Each segment: dasharray = sharePct * CIRCUMFERENCE, rotate via dashoffset.
  const { segments } = orderedChannels.reduce<{
    segments: { ch: typeof orderedChannels[0]; dashLen: number; dashOffset: number }[];
    cumulative: number;
  }>(
    (acc, ch) => {
      const share = (ch.share_pct ?? 0) / 100;
      const dashLen = share * CIRCUMFERENCE;
      acc.segments.push({ ch, dashLen, dashOffset: -acc.cumulative });
      return { segments: acc.segments, cumulative: acc.cumulative + dashLen };
    },
    { segments: [], cumulative: 0 },
  );

  const afterHoursDisplay =
    afterHoursPct != null && !isNaN(afterHoursPct)
      ? `${Math.round(afterHoursPct)}% after hours`
      : null;

  return (
    <div
      className="relative mx-auto"
      style={{ width: 230, height: 230 }}
      role="img"
      aria-label={`Donut chart: ${totalConversations} total conversations across ${orderedChannels.length} channels`}
    >
      <svg
        width="230"
        height="230"
        viewBox="0 0 230 230"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Background ring */}
        <circle
          cx="115"
          cy="115"
          r={RADIUS}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="30"
        />
        {/* Channel segments */}
        {segments.map(({ ch, dashLen, dashOffset }) => {
          const meta = getChannelMeta(ch.channel as AttributionChannel);
          return (
            <circle
              key={ch.channel}
              cx="115"
              cy="115"
              r={RADIUS}
              fill="none"
              stroke={meta.color}
              strokeWidth="30"
              strokeDasharray={`${dashLen} ${CIRCUMFERENCE - dashLen}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>

      {/* Center label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        aria-hidden="true"
      >
        <span
          className="font-extrabold text-slate-900 leading-none"
          style={{ fontSize: '1.9rem', letterSpacing: '-0.02em' }}
        >
          {totalConversations.toLocaleString()}
        </span>
        <span
          className="font-bold uppercase text-slate-400 mt-1"
          style={{ fontSize: '0.6rem', letterSpacing: '0.07em' }}
        >
          conversations
        </span>
        {afterHoursDisplay && (
          <span
            className="font-extrabold text-primary-700 bg-primary-50 rounded-full px-3 mt-2"
            style={{ fontSize: '0.68rem', padding: '3px 10px' }}
          >
            {afterHoursDisplay}
          </span>
        )}
      </div>
    </div>
  );
}
