import {
  capKey,
  parseCsv,
  parseTiktokDay,
  parseTiktokCsv,
  matchByCaption,
} from '../../../src/lib/social/tiktokCsv';

// Header + row shapes taken verbatim from a real TikTok Studio Overview export.
const OVERVIEW = `"Date","Video Views","Profile Views","Likes","Comments","Shares"
"28 May","0","0","0","0","0"
"9 July","869","2","167","0","1"
"18 July","35799","317","44","4","2"
"26 July","58","0","2","0","0"
`;

// Current exports carry followers; older ones (above) do not.
const OVERVIEW_WITH_FOLLOWERS = `"Date","Video Views","Profile Views","Likes","Comments","Shares","New followers"
"16 July","31185","277","39","64","1","112"
"19 July","80","0","3","0","0","-4"
`;

// TikTok Ads Manager, which is a different report from either Studio export.
const ADS = `"Date","Campaign name","Cost (ZAR)","Impressions","Clicks (destination)"
"2026-07-16","jul-promote","412.50","31185","688"
"2026-07-18","jul-promote","587.25","35799","921"
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
      followerChange: null,
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

describe('matchByCaption', () => {
  // Real posting habit: the first caption line (the on-image headline) gets
  // dropped when posting, so the platform title starts mid-caption.
  const posts = [
    {
      id: 'a',
      caption:
        'Godzilla or Thing — who runs the city? Comment your pick — no wrong answers (except the wrong one 😏). mythique.app',
    },
    { id: 'b', caption: 'Top 10 Best Fighters. Do you agree? Who is too low? Settle it below 👇' },
    { id: 'c', caption: 'Six stats. One legend. Who is it? 🤔 Answer in the last slide' },
    { id: 'd', caption: 'Six stats. One legend. Who is it? 🤔 Answer in the last slide' },
  ];

  it('matches a caption whose first line was dropped at post time', () => {
    const r = matchByCaption(
      'Comment your pick — no wrong answers (except the wrong one 😏). mythique.app',
      posts,
    );
    expect(r.post?.id).toBe('a');
    expect(r.candidates).toBe(1);
  });

  it('still matches a full verbatim caption (prefix is a substring)', () => {
    const r = matchByCaption('Top 10 Best Fighters. Do you agree? Who is too low?', posts);
    expect(r.post?.id).toBe('b');
  });

  it('disambiguates template siblings via the full caption (hashtags)', () => {
    const siblings = [
      {
        id: 'aq',
        caption:
          "Name one character who beats Aquaman. I'll wait. Drop them below 👇 back it up. #aquaman #comics",
      },
      {
        id: 'ls',
        caption:
          "Name one character who beats Luke Skywalker. I'll wait. Drop them below 👇 back it up. #lukeskywalker #comics",
      },
    ];
    // Same 40-char opener once the first line is dropped — only the tail differs.
    const r = matchByCaption('Drop them below 👇 back it up. #aquaman #comics', siblings);
    expect(r.post?.id).toBe('aq');
  });

  it('refuses to guess between posts sharing an identical caption', () => {
    const r = matchByCaption('Six stats. One legend. Who is it? 🤔', posts);
    expect(r.post).toBeNull();
    expect(r.candidates).toBe(2);
  });

  it('no hits → unmatched with zero candidates', () => {
    const r = matchByCaption('Something never queued', posts);
    expect(r.post).toBeNull();
    expect(r.candidates).toBe(0);
  });
});

describe('capKey', () => {
  it('matches the edge functions: lowercase, alphanumeric, 40 chars', () => {
    expect(capKey("Who's missing? Who's too low? 👇 #fyp")).toBe('whosmissingwhostoolowfyp');
    expect(capKey(null)).toBe('');
    expect(capKey('X'.repeat(80))).toHaveLength(40);
  });
});

describe('follower columns', () => {
  it('reads new followers when the export has them, including a net loss', () => {
    const p = parseTiktokCsv(OVERVIEW_WITH_FOLLOWERS, TODAY);
    expect(p.kind).toBe('overview');
    if (p.kind !== 'overview') return;
    expect(p.rows[0].followerChange).toBe(112);
    // A day that lost followers is real data, not a parse failure.
    expect(p.rows[1].followerChange).toBe(-4);
  });

  it('reports unknown rather than zero when the column is absent', () => {
    const p = parseTiktokCsv(OVERVIEW, TODAY);
    expect(p.kind).toBe('overview');
    if (p.kind !== 'overview') return;
    // Zero would claim a day of no growth we cannot actually see.
    expect(p.rows[0].followerChange).toBeNull();
  });
});

describe('ads export', () => {
  it('parses spend as cents, never a float', () => {
    const p = parseTiktokCsv(ADS, TODAY);
    expect(p.kind).toBe('ads');
    if (p.kind !== 'ads') return;
    expect(p.rows[0]).toEqual({
      campaign: 'jul-promote',
      day: '2026-07-16',
      spendMinor: 41250,
      currency: 'ZAR',
      impressions: 31185,
      clicks: 688,
    });
    expect(p.rows.reduce((t, r) => t + r.spendMinor, 0)).toBe(99975);
  });

  it('takes the currency from the cost header', () => {
    const p = parseTiktokCsv(ADS.replace('Cost (ZAR)', 'Cost (USD)'), TODAY);
    if (p.kind !== 'ads') throw new Error('expected ads');
    expect(p.rows[0].currency).toBe('USD');
  });

  it('is detected before the overview branch, which also has a Date column', () => {
    // Both files start with Date; whichever branch runs first wins, so the cost
    // column has to be the discriminator.
    expect(parseTiktokCsv(ADS, TODAY).kind).toBe('ads');
  });

  it('skips rows with no cost or no date rather than importing zeroes', () => {
    const withJunk = ADS + '"","jul-promote","","",""\n"2026-07-19","jul-promote","","",""\n';
    const p = parseTiktokCsv(withJunk, TODAY);
    if (p.kind !== 'ads') throw new Error('expected ads');
    expect(p.rows).toHaveLength(2);
  });

  it('throws when an ads-shaped file has no usable rows', () => {
    const empty = '"Date","Campaign name","Cost (ZAR)"\n"","",""\n';
    expect(() => parseTiktokCsv(empty, TODAY)).toThrow(/no dated rows/i);
  });
});

describe('parseTiktokDay ISO support', () => {
  it('accepts the ISO dates Ads Manager emits', () => {
    expect(parseTiktokDay('2026-07-18', TODAY)).toBe('2026-07-18');
    expect(parseTiktokDay('2026-07-18 00:00:00', TODAY)).toBe('2026-07-18');
  });
});
