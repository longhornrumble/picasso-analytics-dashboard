import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../components/shared';
import { AlertGallery } from '../AlertGallery';

afterEach(cleanup);

function renderGallery() {
  render(
    <ToastProvider>
      <AlertGallery />
    </ToastProvider>,
  );
}

describe('AlertGallery (demo surface)', () => {
  it('renders banners and inline alerts', () => {
    renderGallery();
    expect(screen.getByText('Alert system — live preview')).toBeInTheDocument();
    expect(screen.getByText('error banner')).toBeInTheDocument();
    expect(screen.getByText('Calendar token expired')).toBeInTheDocument();
  });

  it('a toast button fires a toast through useToast', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    expect(screen.getByText('Team saved')).toBeInTheDocument();
  });

  it('dismissing a banner removes it; Reset brings it back', () => {
    renderGallery();
    const dismiss = screen.getAllByRole('button', { name: 'Dismiss' })[0]; // reconnect banner (first)
    fireEvent.click(dismiss);
    expect(screen.queryByText('Google Calendar disconnected')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset dismissed' }));
    expect(screen.getByText('Google Calendar disconnected')).toBeInTheDocument();
  });
});
