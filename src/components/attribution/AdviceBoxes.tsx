/**
 * AdviceBoxes — Read + Suggested-move boxes.
 *
 * Text rendered verbatim from API (rules live server-side per C6).
 * Design ref: v5 mockup .advice section.
 */

import type { AttributionAdviceBox } from '../../types/attribution';

interface AdviceBoxesProps {
  read?: AttributionAdviceBox | null;
  suggestedMove?: AttributionAdviceBox | null;
}

interface BoxProps {
  kicker: string;
  text: string | null | undefined;
}

function Box({ kicker, text }: BoxProps) {
  return (
    <div
      style={{
        borderLeft: '3px solid #50C878',
        background: '#ecfdf5',
        borderRadius: '0 10px 10px 0',
        padding: '13px 16px',
        fontSize: '0.8rem',
        color: '#334155',
        lineHeight: 1.6,
      }}
    >
      <span
        className="block font-extrabold uppercase"
        style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: '#047857', marginBottom: 5 }}
      >
        {kicker}
      </span>
      {text || <span className="text-slate-400 italic">No recommendation available yet.</span>}
    </div>
  );
}

export function AdviceBoxes({ read, suggestedMove }: AdviceBoxesProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: '1fr 1fr' }}
      role="complementary"
      aria-label="Recommendations"
    >
      <Box kicker="Read" text={read?.text} />
      <Box kicker="Suggested move" text={suggestedMove?.text} />
    </div>
  );
}
