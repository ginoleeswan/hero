import {
  mergeActivityFeed,
  eventToFeedItem,
} from '../../../../src/components/admin/health/domains/overview/feed';
import type { EnrichmentRun } from '../../../../src/lib/db/catalogHealth';

const run = (over: Partial<EnrichmentRun>): EnrichmentRun =>
  ({
    id: 1,
    run_type: 'comicvine',
    triggered_by: 'admin',
    status: 'done',
    started_at: null,
    cancel_requested: false,
    processed: 0,
    done: 40,
    failed: 0,
    retry: 0,
    remaining: null,
    duration_ms: 1000,
    created_at: '2026-07-08T10:00:00.000Z',
    ...over,
  }) as EnrichmentRun;

describe('mergeActivityFeed', () => {
  it('orders all three streams newest-first', () => {
    const feed = mergeActivityFeed({
      runs: [run({ id: 7, created_at: '2026-07-08T10:00:00.000Z' })],
      live: [
        {
          route: '/character/x',
          path: '/character/x',
          name: 'Batman',
          at: '2026-07-08T10:05:00.000Z',
        },
      ],
      community: [{ kind: 'vote', at: '2026-07-08T10:02:00.000Z', heroId: 'g', heroName: 'Goku' }],
    });
    expect(feed.map((f) => f.text)).toEqual([
      'Viewing Batman',
      'Voted Goku',
      'Run #7 finished · 40 enriched',
    ]);
  });

  it('maps run status to icon + tint', () => {
    const err = mergeActivityFeed({ runs: [run({ status: 'error', id: 9 })] })[0];
    expect(err.icon).toBe('close-circle');
    expect(err.text).toBe('Run #9 errored');
  });

  it('labels an anonymous page view by path when no hero name resolves', () => {
    const [item] = mergeActivityFeed({
      live: [{ route: '/versus', path: '/versus', name: null, at: '2026-07-08T10:00:00.000Z' }],
    });
    expect(item.text).toBe('Visit · /versus');
  });

  it('skips community view items (traffic.live owns the view pulse)', () => {
    const feed = mergeActivityFeed({
      community: [
        { kind: 'view', at: '2026-07-08T10:00:00.000Z', heroId: 'a', heroName: 'A' },
        { kind: 'favourite', at: '2026-07-08T09:00:00.000Z', heroId: 'b', heroName: 'B' },
      ],
    });
    expect(feed.map((f) => f.text)).toEqual(['Favourited B']);
  });

  it('caps to the limit', () => {
    const runs = Array.from({ length: 30 }, (_, i) =>
      run({ id: i, created_at: `2026-07-08T10:${String(i).padStart(2, '0')}:00.000Z` }),
    );
    expect(mergeActivityFeed({ runs, limit: 5 })).toHaveLength(5);
  });
});

describe('eventToFeedItem', () => {
  const base = {
    heroId: null,
    heroName: null,
    route: null,
    path: null,
    sessionId: null,
    signedIn: null,
    country: null,
    city: null,
    device: null,
    browser: null,
    os: null,
    runId: null,
    runStatus: null,
    runDone: null,
    text: null,
  };

  it('renders an enriched page view with a where · device · browser context line', () => {
    const it = eventToFeedItem({
      ...base,
      kind: 'view',
      at: '2026-09-15T10:00:00Z',
      heroId: 'batman',
      heroName: 'Batman',
      route: '/character/[id]',
      path: '/character/batman',
      signedIn: true,
      country: 'DE',
      city: 'Berlin',
      device: 'mobile',
      browser: 'Safari',
      os: 'iOS',
    });
    expect(it.text).toBe('Viewing Batman');
    expect(it.meta).toBe('Berlin, Germany · mobile · Safari on iOS · signed in');
    expect(it.heroId).toBe('batman');
  });

  it('leaves the context line off a bare (pre-enrichment) view', () => {
    const it = eventToFeedItem({
      ...base,
      kind: 'view',
      at: '2026-09-15T10:00:00Z',
      path: '/explore',
    });
    expect(it.text).toBe('Visit · /explore');
    expect(it.meta).toBeUndefined();
  });

  it('maps engagement and run kinds to the same vocabulary as the merged feed', () => {
    expect(
      eventToFeedItem({ ...base, kind: 'vote', at: '2026-09-15T10:00:00Z', heroName: 'Goku' }).text,
    ).toBe('Voted Goku');
    expect(
      eventToFeedItem({
        ...base,
        kind: 'run',
        at: '2026-09-15T10:00:00Z',
        runId: 7,
        runStatus: 'done',
        runDone: 40,
      }).text,
    ).toBe('Run #7 finished · 40 enriched');
    expect(
      eventToFeedItem({
        ...base,
        kind: 'run',
        at: '2026-09-15T10:00:00Z',
        runId: 8,
        runStatus: 'error',
      }).text,
    ).toBe('Run #8 errored');
  });
});
