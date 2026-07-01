import { REPORT_REASONS, resolveReportTarget } from '../../src/lib/db/reports';

describe('REPORT_REASONS', () => {
  it('exposes reason sets for page and image contexts', () => {
    expect(REPORT_REASONS.page.map((r) => r.code)).toEqual(
      expect.arrayContaining([
        'inaccurate',
        'ai_inaccurate',
        'offensive',
        'duplicate',
        'spam',
        'other',
      ]),
    );
    expect(REPORT_REASONS.image.map((r) => r.code)).toEqual(
      expect.arrayContaining(['wrong_subject', 'offensive', 'low_quality', 'other']),
    );
    // Every reason has a non-empty human label.
    for (const ctx of ['page', 'image'] as const)
      for (const r of REPORT_REASONS[ctx]) expect(r.label.length).toBeGreaterThan(0);
  });
});

describe('resolveReportTarget', () => {
  it('maps the page "ai_inaccurate" reason to the ai_portrait target with the portrait url', () => {
    expect(
      resolveReportTarget('page', 'ai_inaccurate', { portraitUrl: 'p.jpg', imageUrl: null }),
    ).toEqual({ targetType: 'ai_portrait', imageUrl: 'p.jpg' });
  });
  it('keeps ordinary page reasons on the page target with no image', () => {
    expect(resolveReportTarget('page', 'inaccurate', { portraitUrl: 'p.jpg' })).toEqual({
      targetType: 'page',
      imageUrl: null,
    });
  });
  it('maps image context to the image target carrying the shown image url', () => {
    expect(resolveReportTarget('image', 'wrong_subject', { imageUrl: 'g.jpg' })).toEqual({
      targetType: 'image',
      imageUrl: 'g.jpg',
    });
  });
});
