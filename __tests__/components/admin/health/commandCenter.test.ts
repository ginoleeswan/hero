import {
  buildAlerts,
  actionableBacklog,
  backlogEtaLabel,
  CV_HOURLY_CAP,
} from '../../../../src/components/admin/health/format';

describe('buildAlerts', () => {
  const base = {
    cvPing: undefined,
    cvUsage: 0,
    cvFailed: 0,
    lastRunStatus: undefined,
    unbrandedCount: 0,
    openReports: 0,
  };

  it('returns no alerts when everything is healthy', () => {
    expect(buildAlerts(base)).toEqual([]);
  });

  it('flags ComicVine rate limiting (gold)', () => {
    const a = buildAlerts({ ...base, cvPing: 'limited' });
    expect(a).toHaveLength(1);
    expect(a[0].tone).toBe('gold');
    expect(a[0].text).toMatch(/rate-limited/);
  });

  it('flags high CV usage at 80% of the cap, but not below', () => {
    expect(buildAlerts({ ...base, cvUsage: CV_HOURLY_CAP * 0.8 })).toHaveLength(1);
    expect(buildAlerts({ ...base, cvUsage: CV_HOURLY_CAP * 0.8 - 1 })).toEqual([]);
  });

  it('rate-limited wins over high usage (one CV alert, not two)', () => {
    const a = buildAlerts({ ...base, cvPing: 'limited', cvUsage: CV_HOURLY_CAP });
    expect(a.filter((x) => /ComicVine/i.test(x.text))).toHaveLength(1);
  });

  it('flags failed heroes and errored last run (red)', () => {
    const a = buildAlerts({ ...base, cvFailed: 3, lastRunStatus: 'error' });
    expect(a.map((x) => x.tone)).toEqual(['red', 'red']);
    expect(a[0].text).toMatch(/3 hero/);
  });

  it('points open reports at the Inbox lane with singular/plural copy', () => {
    expect(buildAlerts({ ...base, openReports: 1 })[0].text).toBe(
      '1 open report — see Inbox.',
    );
    expect(buildAlerts({ ...base, openReports: 2 })[0].text).toBe(
      '2 open reports — see Inbox.',
    );
  });

  it('flags unbranded heroes toward Catalog › Hygiene', () => {
    const a = buildAlerts({ ...base, unbrandedCount: 5 });
    expect(a[0].tone).toBe('gold');
    expect(a[0].text).toMatch(/Catalog › Hygiene/);
  });
});

describe('actionableBacklog', () => {
  it('falls back to pendingNow without progress data', () => {
    expect(actionableBacklog(undefined, 2, 40)).toBe(40);
  });

  it('subtracts terminal states from the total', () => {
    const progress = {
      heroesTotal: 100,
      enriched: 60,
      comicvineUnmatched: 10,
      ambiguous: 5,
      unresolved: 5,
    };
    // 100 - 60 - 3 failed - 10 - 5 - 5 = 17
    expect(actionableBacklog(progress, 3, 999)).toBe(17);
  });

  it('never goes negative', () => {
    const progress = {
      heroesTotal: 10,
      enriched: 10,
      comicvineUnmatched: 5,
      ambiguous: 0,
      unresolved: 0,
    };
    expect(actionableBacklog(progress, 5, 0)).toBe(0);
  });
});

describe('backlogEtaLabel', () => {
  it('is null with no completed drain runs', () => {
    expect(backlogEtaLabel([], 100)).toBeNull();
    expect(backlogEtaLabel([{ status: 'running', duration_ms: null, done: 0 }], 100)).toBeNull();
  });

  it('is null when nothing is actionable', () => {
    expect(
      backlogEtaLabel([{ status: 'done', duration_ms: 60_000, done: 10 }], 0),
    ).toBeNull();
  });

  it('formats minutes under an hour, hours above', () => {
    // 10 done per minute → 50 actionable = 5m; 900 actionable = 90m = 1.5h
    const runs = [{ status: 'done', duration_ms: 60_000, done: 10 }];
    expect(backlogEtaLabel(runs, 50)).toBe('~5m to clear');
    expect(backlogEtaLabel(runs, 900)).toBe('~1.5h to clear');
  });
});
