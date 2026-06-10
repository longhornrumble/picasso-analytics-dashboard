import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

afterEach(cleanup);

const TYPES = [
  { appointment_type_id: 'a1', name: 'Discovery', duration_minutes: 30, routing_policy_id: 'rp1' },
  { appointment_type_id: 'a2', name: 'Interview', duration_minutes: 60, routing_policy_id: 'rp1' },
];

describe('useAppointmentTypeNames', () => {
  it('builds an id→name map when enabled (admin)', async () => {
    vi.resetModules();
    vi.doMock('../../../services/schedulingApi', () => ({
      fetchAppointmentTypes: () => Promise.resolve(TYPES),
    }));
    const { useAppointmentTypeNames } = await import('../useAppointmentTypeNames');

    const { result } = renderHook(() => useAppointmentTypeNames(true));
    await waitFor(() => expect(Object.keys(result.current.names)).toHaveLength(2));
    expect(result.current.names).toEqual({ a1: 'Discovery', a2: 'Interview' });
    expect(result.current.loading).toBe(false);

    vi.doUnmock('../../../services/schedulingApi');
  });

  it('returns an empty map when disabled (staff) without calling the admin-only endpoint', async () => {
    vi.resetModules();
    const fetchSpy = vi.fn(() => Promise.resolve(TYPES));
    vi.doMock('../../../services/schedulingApi', () => ({ fetchAppointmentTypes: fetchSpy }));
    const { useAppointmentTypeNames } = await import('../useAppointmentTypeNames');

    const { result } = renderHook(() => useAppointmentTypeNames(false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.names).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.doUnmock('../../../services/schedulingApi');
  });

  it('falls back to an empty map (non-fatal) when the fetch fails', async () => {
    vi.resetModules();
    vi.doMock('../../../services/schedulingApi', () => ({
      fetchAppointmentTypes: () => Promise.reject(new Error('403')),
    }));
    const { useAppointmentTypeNames } = await import('../useAppointmentTypeNames');

    const { result } = renderHook(() => useAppointmentTypeNames(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.names).toEqual({});

    vi.doUnmock('../../../services/schedulingApi');
  });
});
