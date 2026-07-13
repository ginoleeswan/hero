import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;

describe('useAuth', () => {
  afterEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('returns null user initially', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });

  it('exposes signIn, signUp, signOut functions', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
  });

  // The whole app is gated on `loading`; if getSession() rejects and loading never
  // clears, the web app hangs on the splash loader forever. These guard that path.
  it('clears loading when getSession rejects', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('clears loading via the safety timeout when getSession never settles', async () => {
    jest.useFakeTimers();
    // A promise that never resolves — simulates a hung auth request.
    mockGetSession.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(result.current.loading).toBe(false);
    jest.useRealTimers();
  });
});
