import {
  capKey,
  parseCsv,
  parseTiktokDay,
  parseTiktokCsv,
} from '../../../src/lib/social/tiktokCsv';

// Header + row shapes taken verbatim from a real TikTok Studio Overview export.
const OVERVIEW = `"Date","Video Views","Profile Views","Likes","Comments","Shares"
"28 May","0","0","0","0","0"
"9 July","869","2","167","0","1"
"18 July","35799","317","44","4","2"
"26 July","58","0","2","0","0"
`;

const TODAY = new Date('2026-07-28T12:00:00Z');

describe('parseCsv', () => {
  it('handles quoted fields, embedded commas and CRLF', () => {
    const grid = parseCsv('"a","b,c","d""e"\r\n"1","2","3"\r\n');
    expect(grid).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });
});

describe('parseTiktokDay', () => {
  it('assumes the current year for past dates', () => {
    expect(parseTiktokDay('9 July', TODAY)).toBe('2026-07-09');
  });
  it('rolls back a year when the date would be in the future', () => {
    expect(parseTiktokDay('30 December', new Date('2027-01-05T00:00:00Z'))).toBe('2026-12-30');
  });
  it('rejects garbage', () => {
    expect(parseTiktokDay('Total', TODAY)).toBeNull();
  });
});

describe('parseTiktokCsv — overview export', () => {
  it('detects the daily account series and maps every column', () => {
    const parsed = parseTiktokCsv(OVERVIEW, TODAY);
    expect(parsed.kind).toBe('overview');
    if (parsed.kind !== 'overview') return;
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[1]).toEqual({
      day: '2026-07-09',
      views: 869,
      profileViews: 2,
      likes: 167,
      comments: 0,
      shares: 1,
    });
    expect(parsed.rows[2].views).toBe(35799);
  });
});

describe('parseTiktokCsv — content export', () => {
  it('detects per-post rows and prefers total metrics over windowed ones', () => {
    const csv = `"Video title","Video link","Post time","Views in the last 7 days","Total views","Total likes","Total comments","Total shares"
"Who's missing? Who's too low? Settle it below","https://tiktok.com/@x/video/1","2026-07-12 09:00","153","26000","1500","12","20"
"","https://tiktok.com/@x/video/2","2026-07-13 09:00","1","2","0","0","0"
`;
    const parsed = parseTiktokCsv(csv, TODAY);
    expect(parsed.kind).toBe('content');
    if (parsed.kind !== 'content') return;
    // caption-less rows are dropped (nothing to match on)
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual({
      caption: "Who's missing? Who's too low? Settle it below",
      postUrl: 'https://tiktok.com/@x/video/1',
      views: 26000,
      likes: 1500,
      comments: 12,
      shares: 20,
    });
  });

  it('throws on an unrecognised shape', () => {
    expect(() => parseTiktokCsv('"Foo","Bar"\n"1","2"\n', TODAY)).toThrow(/Unrecognised/);
  });
});

describe('capKey', () => {
  it('matches the edge functions: lowercase, alphanumeric, 40 chars', () => {
    expect(capKey("Who's missing? Who's too low? 👇 #fyp")).toBe('whosmissingwhostoolowfyp');
    expect(capKey(null)).toBe('');
    expect(capKey('X'.repeat(80))).toHaveLength(40);
  });
});
