import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useActivityLog, useCatalogActions } from '../../../../src/components/admin/health/hooks';
import * as db from '../../../../src/lib/db/catalogHealth';

jest.mock('../../../../src/lib/db/catalogHealth', () => ({
  runDrain: jest.fn(),
  retryFailed: jest.fn(),
  stopRun: jest.fn(),
  snapshotNow: jest.fn(),
  reenrichHero: jest.fn(),
  setDrainCron: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useActivityLog', () => {
  it('records events newest-first and caps the log at 80', () => {
    const { result } = renderHook(() => useActivityLog());
    act(() => {
      for (let i = 0; i < 85; i++) result.current.logEvent('info', `e${i}`);
    });
    expect(result.current.log).toHaveLength(80);
    expect(result.current.log[0].text).toBe('e84');
  });

  it('flash shows a toast that auto-clears and is also logged; clearLog empties', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useActivityLog());
    act(() => result.current.flash('done', 'success'));
    expect(result.current.toast).toBe('done');
    expect(result.current.log[0]).toMatchObject({ text: 'done', tone: 'success' });
    act(() => jest.advanceTimersByTime(4000));
    expect(result.current.toast).toBeNull();
    act(() => result.current.clearLog());
    expect(result.current.log).toEqual([]);
    jest.useRealTimers();
  });
});

describe('useCatalogActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('onRetryFailed flashes success with the requeued count', async () => {
    (db.retryFailed as jest.Mock).mockResolvedValue(3);
    const flash = jest.fn();
    const { result } = renderHook(() => useCatalogActions({ batchSize: 25, cronOn: false, flash }), { wrapper });
    await act(async () => {
      await result.current.onRetryFailed();
    });
    expect(db.retryFailed).toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('3 failed heroes requeued.', 'success');
  });

  it('reports a failed mutation via flash(error)', async () => {
    (db.runDrain as jest.Mock).mockRejectedValue(new Error('boom'));
    const flash = jest.fn();
    const { result } = renderHook(() => useCatalogActions({ batchSize: 10, cronOn: false, flash }), { wrapper });
    await act(async () => {
      await result.current.onRunDrain();
    });
    expect(flash).toHaveBeenCalledWith('Drain failed: boom', 'error');
  });

  it('onToggleCron sends the negated cron state', async () => {
    (db.setDrainCron as jest.Mock).mockResolvedValue('disabled');
    const flash = jest.fn();
    const { result } = renderHook(() => useCatalogActions({ batchSize: 25, cronOn: true, flash }), { wrapper });
    await act(async () => {
      await result.current.onToggleCron();
    });
    expect(db.setDrainCron).toHaveBeenCalledWith(false);
    expect(flash).toHaveBeenCalledWith('Auto-drain cron disabled.', 'success');
  });
});
