/**
 * Channel display metadata — icons, colors, labels.
 * Ref: v5 mockup channel rows and ecosystem donut segments.
 */

import type { AttributionChannel } from '../../types/attribution';

export interface ChannelMeta {
  label: string;
  /** Donut segment / swatch color (hex) */
  color: string;
  /** SVG path data for the channel icon (24×24 viewBox, stroke-only) */
  iconPaths: string[];
}

// Colors mirror the v5 mockup donut: website=slate-300, messenger=emerald-300,
// standalone=emerald-500, campaign=slate-200.
const CHANNEL_META: Record<AttributionChannel, ChannelMeta> = {
  website: {
    label: 'Website widget',
    color: '#cbd5e1',
    iconPaths: [
      'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z',
      'M2 12h20',
      'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    ],
  },
  messenger: {
    label: 'Messenger & Instagram',
    color: '#6ee7b7',
    iconPaths: [
      'M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.4-.7L3 21l1.8-5.6a8.38 8.38 0 0 1-.7-3.4 8.5 8.5 0 1 1 16.9-.5z',
    ],
  },
  standalone: {
    label: 'QR codes & standalone',
    color: '#50C878',
    iconPaths: [
      'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z',
      'M14 14h3v3h-3zM21 14v3M14 21h3M21 21h.01',
    ],
  },
  campaign: {
    label: 'Campaign links',
    color: '#e2e8f0',
    iconPaths: [
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    ],
  },
};

export function getChannelMeta(channel: AttributionChannel | string): ChannelMeta {
  return (
    CHANNEL_META[channel as AttributionChannel] ?? {
      label: channel,
      color: '#94a3b8',
      iconPaths: ['M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z'],
    }
  );
}

export const CHANNEL_ORDER: AttributionChannel[] = [
  'website',
  'messenger',
  'standalone',
  'campaign',
];
