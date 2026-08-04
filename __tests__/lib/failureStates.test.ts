// "Failed" vs "not found" is one boolean apart and both readings look
// plausible in code, which is exactly how three screens ended up telling users
// a hero/team/event did not exist when the network was simply down. These pin
// the rule rather than the wiring.
import { planHeroLoad } from '../../src/lib/query/heroLoadPlan';

describe('planHeroLoad', () => {
  const base = { isPlaceholderData: false, isError: false, isSuccess: false, row: null };

  it('reports an error as an error, not a 404', () => {
    // This branch was dead until getHeroById stopped swallowing errors into
    // null: the query always "succeeded" with no row, so a network failure
    // resolved to 'not-found' and the character page declared the hero missing
    // instead of offering its retry.
    expect(planHeroLoad({ ...base, isError: true })).toBe('error');
  });

  it('only calls a hero missing once the fetch actually succeeded', () => {
    expect(planHeroLoad({ ...base, isSuccess: true, row: null })).toBe('not-found');
    // Settled-but-not-successful must keep waiting, never claim not-found.
    expect(planHeroLoad({ ...base, isSuccess: false, row: null })).toBe('wait');
  });

  it('prefers the error verdict over a missing row', () => {
    // Both true at once (a refetch that failed after a successful empty) must
    // not silently downgrade to 'not-found'.
    expect(planHeroLoad({ ...base, isError: true, isSuccess: true, row: null })).toBe('error');
  });

  it('ignores the instant placeholder', () => {
    expect(planHeroLoad({ ...base, isPlaceholderData: true, isError: true })).toBe('wait');
  });

  it('renders once a row is in hand', () => {
    expect(planHeroLoad({ ...base, isSuccess: true, row: { id: 'x' } as never })).toBe(
      'render-row',
    );
  });
});

/**
 * The shape every "did this screen fail or is it genuinely empty?" call now
 * uses. `isFetched` is true after a FAILURE too, which is why the team screen
 * rendered "This team doesn't exist" during an outage.
 */
function resolveState(q: { isSuccess: boolean; isError: boolean; data: unknown }) {
  if (q.isError) return 'failed';
  if (q.isSuccess && !q.data) return 'not-found';
  if (q.isSuccess) return 'ready';
  return 'loading';
}

describe('failed vs not-found', () => {
  it('calls a failed fetch failed', () => {
    expect(resolveState({ isSuccess: false, isError: true, data: null })).toBe('failed');
  });

  it('calls an empty successful fetch not-found', () => {
    expect(resolveState({ isSuccess: true, isError: false, data: null })).toBe('not-found');
  });

  it('never calls a failure not-found', () => {
    // The regression this whole pass exists to prevent.
    expect(resolveState({ isSuccess: false, isError: true, data: null })).not.toBe('not-found');
  });

  it('stays loading before either settles', () => {
    expect(resolveState({ isSuccess: false, isError: false, data: null })).toBe('loading');
  });
});
