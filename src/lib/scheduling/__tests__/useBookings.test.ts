import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { allBookings } from '../../../test/fixtures/schedulingFixture';

afterEach(cleanup);

describe('useBookings', () => {
  it('starts loading, then resolves to the fetched booking set', async () => {
    vi.resetModules();
    vi.doMock('../../../services/schedulingApi', () => ({
      fetchBookings: () => Promise.resolve(allBookings),
    }));
    const { useBookings: freshUseBookings } = await import('../useBookings');

    const { result } = renderHook(() => freshUseBookings('tenant_aggregate'));

    expect(result.current.loading).toBe(true);
    expect(result.current.bookings).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.bookings).toEqual(allBookings);

    vi.doUnmock('../../../services/schedulingApi');
  });

  it('surfaces a fetch failure as an error string without throwing', async () => {
    vi.resetModules();
    vi.doMock('../../../services/schedulingApi', () => ({
      fetchBookings: () => Promise.reject(new Error('boom')),
    }));
    const { useBookings: freshUseBookings } = await import('../useBookings');

    const { result } = renderHook(() => freshUseBookings('staff_self'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.bookings).toEqual([]);

    vi.doUnmock('../../../services/schedulingApi');
  });

  it('reload() re-fetches the current scope', async () => {
    vi.resetModules();
    const fetchBookings = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(allBookings);
    vi.doMock('../../../services/schedulingApi', () => ({ fetchBookings }));
    const { useBookings: freshUseBookings } = await import('../useBookings');

    const { result } = renderHook(() => freshUseBookings('tenant_aggregate'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bookings).toEqual([]);

    result.current.reload();
    await waitFor(() => expect(result.current.bookings).toEqual(allBookings));
    expect(fetchBookings).toHaveBeenCalledTimes(2);

    vi.doUnmock('../../../services/schedulingApi');
  });
});
