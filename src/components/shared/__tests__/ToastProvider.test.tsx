import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { Alert } from '../Alert';
import { ToastProvider } from '../ToastProvider';
import { useToast, type ToastApi } from '../useToast';

const EXIT_MS = 200; // mirrors the provider's exit-animation delay

// Capture the api via an onReady callback (calling a function prop — never
// mutating a prop or a render-phase ref). render()'s act() flushes the effect,
// so the closure variable is populated by the time render() returns.
function Capture({ onReady }: { onReady: (api: ToastApi) => void }) {
  const api = useToast();
  useEffect(() => { onReady(api); }, [api, onReady]);
  return null;
}

function mountProvider(): ToastApi {
  let captured: ToastApi | null = null;
  render(
    <ToastProvider>
      <Capture onReady={(a) => { captured = a; }} />
    </ToastProvider>,
  );
  if (!captured) throw new Error('toast api not captured');
  return captured;
}

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useToast contract', () => {
  it('throws when used outside a <ToastProvider>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Capture onReady={() => {}} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('ToastProvider lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('convenience methods render an <Alert placement="toast"> with the right severity role', () => {
    const api = mountProvider();
    act(() => { api.error('Could not save', { duration: 0 }); });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');

    act(() => { api.success('Team saved', { duration: 0 }); });
    expect(screen.getByText('Team saved')).toBeInTheDocument();
  });

  it('auto-dismisses after `duration` (+ the exit animation delay)', () => {
    const api = mountProvider();
    act(() => { api.success('Saved', { duration: 4000 }); });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    tick(4000);          // timer fires → enters exit animation
    expect(screen.getByText('Saved')).toBeInTheDocument(); // still mounted during exit
    tick(EXIT_MS);       // exit completes → removed
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('duration 0 is sticky — never auto-dismisses', () => {
    const api = mountProvider();
    act(() => { api.info('Stays put', { duration: 0 }); });
    tick(60000);
    expect(screen.getByText('Stays put')).toBeInTheDocument();
  });

  it('dismiss via the ✕ removes the toast', () => {
    const api = mountProvider();
    act(() => { api.success('Saved', { duration: 0 }); });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    tick(EXIT_MS);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('pauses the auto-dismiss timer on hover and resumes on leave', () => {
    const api = mountProvider();
    act(() => { api.success('Hover me', { duration: 1000 }); });
    const wrapper = screen.getByText('Hover me').closest('.toast-enter')!;

    tick(600);                          // 400ms remaining
    fireEvent.mouseEnter(wrapper);      // pause → bank remaining
    tick(5000);                         // time passes while paused
    expect(screen.getByText('Hover me')).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);      // resume with 400ms remaining
    tick(400);
    tick(EXIT_MS);
    expect(screen.queryByText('Hover me')).toBeNull();
  });

  it('caps the visible stack at 3, dropping the oldest', () => {
    const api = mountProvider();
    act(() => {
      api.info('a', { duration: 0 });
      api.info('b', { duration: 0 });
      api.info('c', { duration: 0 });
      api.info('d', { duration: 0 });
    });
    expect(screen.queryByText('a')).toBeNull();
    for (const t of ['b', 'c', 'd']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('escape hatch renders a fully custom node', () => {
    const api = mountProvider();
    act(() => { api(<Alert severity="info" placement="toast" title="Custom node" />, { duration: 0 }); });
    expect(screen.getByText('Custom node')).toBeInTheDocument();
  });

  it('dismiss(id) removes a specific sticky toast', () => {
    const api = mountProvider();
    let id = 0;
    act(() => { id = api.warning('Targeted', { duration: 0 }); });
    expect(screen.getByText('Targeted')).toBeInTheDocument();
    act(() => { api.dismiss(id); });
    expect(screen.queryByText('Targeted')).toBeNull();
  });
});
