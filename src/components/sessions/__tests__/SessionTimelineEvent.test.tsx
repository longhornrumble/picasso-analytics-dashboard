import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionTimelineEvent } from '../SessionTimelineEvent';
import type { SessionEvent } from '../../../types/analytics';

afterEach(cleanup);

function makeEvent(eventType: SessionEvent['event_type'], payload: Record<string, unknown>): SessionEvent {
  return {
    step_number: 1,
    event_type: eventType,
    timestamp: '2026-06-05T00:00:00Z',
    payload: payload as SessionEvent['payload'],
  };
}

describe('SessionTimelineEvent — §E5 Chain 2 content_preview_en read-path', () => {
  describe('MESSAGE_SENT', () => {
    it('old-shape (no content_preview_en): falls back to content_preview', () => {
      render(<SessionTimelineEvent event={makeEvent('MESSAGE_SENT', {
        type: 'MESSAGE_SENT',
        content_preview: 'Hola, necesito ayuda',
      })} />);
      expect(screen.getByText(/Hola, necesito ayuda/)).toBeInTheDocument();
    });

    it('new-shape: prefers content_preview_en over content_preview', () => {
      render(<SessionTimelineEvent event={makeEvent('MESSAGE_SENT', {
        type: 'MESSAGE_SENT',
        content_preview: 'Hola, necesito ayuda',
        content_preview_en: 'Hi, I need help',
      })} />);
      expect(screen.getByText(/Hi, I need help/)).toBeInTheDocument();
      expect(screen.queryByText(/Hola, necesito ayuda/)).not.toBeInTheDocument();
    });
  });

  describe('MESSAGE_RECEIVED', () => {
    it('old-shape (no content_preview_en): falls back to content_preview', () => {
      render(<SessionTimelineEvent event={makeEvent('MESSAGE_RECEIVED', {
        type: 'MESSAGE_RECEIVED',
        content_preview: 'Claro, con gusto te ayudo',
      })} />);
      expect(screen.getByText(/Claro, con gusto te ayudo/)).toBeInTheDocument();
    });

    it('new-shape: prefers content_preview_en over content_preview', () => {
      render(<SessionTimelineEvent event={makeEvent('MESSAGE_RECEIVED', {
        type: 'MESSAGE_RECEIVED',
        content_preview: 'Claro, con gusto te ayudo',
        content_preview_en: 'Sure, happy to help',
      })} />);
      expect(screen.getByText(/Sure, happy to help/)).toBeInTheDocument();
      expect(screen.queryByText(/Claro, con gusto te ayudo/)).not.toBeInTheDocument();
    });
  });
});
