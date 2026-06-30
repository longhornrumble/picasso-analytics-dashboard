import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from '../Alert';

afterEach(cleanup);

describe('Alert — severity axis', () => {
  it('renders an icon AND a text title (color is never the only signal)', () => {
    render(<Alert severity="success" title="Team saved" />);
    expect(screen.getByText('Team saved')).toBeInTheDocument();
    // the severity icon is decorative SVG → present but aria-hidden
    expect(document.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('uses an assertive role for error/warning and polite role for success/info', () => {
    const { rerender } = render(<Alert severity="error" title="Boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    rerender(<Alert severity="warning" title="Careful" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Careful');
    rerender(<Alert severity="success" title="Done" />);
    expect(screen.getByRole('status')).toHaveTextContent('Done');
    rerender(<Alert severity="info" title="FYI" />);
    expect(screen.getByRole('status')).toHaveTextContent('FYI');
  });

  it('drives surface color from the ONE severity record (exact spec hex)', () => {
    render(<Alert severity="error" placement="inline" title="x" />);
    // error surface = #FEF3F2 → rgb(254, 243, 242)
    expect(screen.getByRole('alert')).toHaveStyle({ background: 'rgb(254, 243, 242)' });
  });

  it('renders a caller-supplied trailing <code> technical detail', () => {
    render(
      <Alert severity="error" title="Calendar token expired" description={<>Bookings paused. <code>(Invalid token: Token expired)</code></>} />,
    );
    expect(screen.getByText('(Invalid token: Token expired)').tagName).toBe('CODE');
  });

  it('honors an icon override', () => {
    render(<Alert severity="info" title="x" icon={<span data-testid="custom-icon">★</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});

describe('Alert — placement axis', () => {
  it('banner is dismissible by default (when onDismiss is provided) and fires it', async () => {
    const onDismiss = vi.fn();
    render(<Alert placement="banner" severity="error" title="Disconnected" onDismiss={onDismiss} />);
    const x = screen.getByRole('button', { name: 'Dismiss' });
    await userEvent.click(x);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('inline is NOT dismissible by default — no ✕ even when onDismiss is passed', () => {
    render(<Alert placement="inline" severity="error" title="Field error" onDismiss={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('inline can opt INTO dismiss; banner can opt OUT', () => {
    const { rerender } = render(<Alert placement="inline" title="x" dismissible onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    rerender(<Alert placement="banner" title="x" dismissible={false} onDismiss={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});

describe('Alert — action button', () => {
  it('renders the action label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Alert placement="banner" severity="error" title="x" action={{ label: 'Reconnect', onClick }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('busy swaps in the busyLabel, disables the button, and shows the spinner', () => {
    render(
      <Alert
        placement="banner"
        severity="error"
        title="x"
        busy
        action={{ label: 'Reconnect', busyLabel: 'Reconnecting…', onClick: () => {} }}
      />,
    );
    const btn = screen.getByRole('button', { name: /Reconnecting/ });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.alert-spinner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconnect' })).toBeNull();
  });
});
