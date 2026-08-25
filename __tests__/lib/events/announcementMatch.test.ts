import {
  isCeremonyTail,
  matchIsCredible,
  workSegment,
} from '../../../src/lib/events/announcementMatch';

describe('matchIsCredible — the three that shipped on Gamescom 2026', () => {
  // Every one of these was live on /event/gamescom/2026 on 2026-08-25, attached
  // by substring containment to a work it has nothing to do with.
  it('rejects a short catalogue name that merely starts a longer one', () => {
    expect(matchIsCredible('Heroes of Might and Magic III Remake Reveal Trailer', 'Heroes')).toBe(
      false,
    );
    expect(matchIsCredible('Heroes of Might and Magic III Remake - Reveal Trailer', 'Heroes')).toBe(
      false,
    );
  });

  it('rejects a name that sits inside the work rather than starting it', () => {
    expect(
      matchIsCredible(
        'Stellar Blade Complete Edition – Action Trailer – Nintendo Switch 2',
        'Blade',
      ),
    ).toBe(false);
  });

  it('does not let a colon subtitle be cut off to make a match', () => {
    // "Aliens: Fireteam Elite 2" is one name. Splitting on the colon is exactly
    // what let the 1986 film claim a 2026 game.
    expect(
      matchIsCredible('Aliens: Fireteam Elite 2 XBOX Launch Video | Available Now', 'Aliens'),
    ).toBe(false);
  });

  it('rejects a sequel claimed by the original', () => {
    expect(
      matchIsCredible(
        'Kingdom Hearts IV - Extended D23 2026 Coco Trailer | PS5 Games',
        'Kingdom Hearts',
      ),
    ).toBe(false);
  });
});

describe('matchIsCredible — and keeps the real ones', () => {
  it('accepts the studio pattern: name first, ceremony after', () => {
    expect(matchIsCredible('Avengers: Doomsday | Official Trailer', 'Avengers: Doomsday')).toBe(
      true,
    );
    expect(
      matchIsCredible(
        'Dead by Daylight - Chorus of Sin Launch Trailer | PS5 & PS4',
        'Dead by Daylight',
      ),
    ).toBe(true);
    expect(
      matchIsCredible(
        'Mario Kart World — Crown City [In the Studio] — Nintendo Music',
        'Mario Kart World',
      ),
    ).toBe(true);
  });

  it('sees through a possessive studio prefix', () => {
    expect(
      matchIsCredible("Marvel Television's VisionQuest | Official Trailer", 'VisionQuest'),
    ).toBe(true);
  });

  it('treats a season marker as ceremony, and a bare number as part of the name', () => {
    expect(
      matchIsCredible(
        'Percy Jackson & the Olympians Season 3 | Teaser Trailer | Disney+',
        'Percy Jackson and the Olympians',
      ),
    ).toBe(true);
    expect(matchIsCredible('Dune 2 | Official Trailer', 'Dune')).toBe(false);
  });

  it('keeps a row it cannot judge rather than hiding it', () => {
    // A missing catalogue name is a data gap, not evidence of a bad match.
    expect(matchIsCredible('Anything At All', null)).toBe(true);
    expect(matchIsCredible('Anything At All', '')).toBe(true);
  });
});

describe('the pieces', () => {
  it('takes the first segment, without cutting at a colon', () => {
    expect(workSegment('Aliens: Fireteam Elite 2 XBOX Launch Video | Available Now')).toBe(
      'aliens fireteam elite 2 xbox launch video',
    );
    expect(workSegment('Stellar Blade Complete Edition – Action Trailer')).toBe(
      'stellar blade complete edition',
    );
    expect(workSegment('Mario Kart World — Crown City [In the Studio]')).toBe('mario kart world');
  });

  it('reads CJK brackets as asides, so repeats of one promo agree', () => {
    // Two uploads of the same Bandai mobile-game promo differed only in what
    // followed the bracket, and landed on opposite verdicts when 【】 was text.
    const a =
      '【ONE PIECE トレジャークルーズ】「ネフェルタリ・ビビ from ONE PIECE magazine」が登場！';
    const b = '【ONE PIECE トレジャークルーズ】「ロキ」「スコッパー・ギャバン」が登場！';
    expect(matchIsCredible(a, 'ONE PIECE')).toBe(matchIsCredible(b, 'ONE PIECE'));
  });

  it('knows ceremony from more of a name', () => {
    expect(isCeremonyTail('official trailer')).toBe(true);
    expect(isCeremonyTail('season 3 teaser trailer')).toBe(true);
    expect(isCeremonyTail('')).toBe(true);
    expect(isCeremonyTail('of might and magic')).toBe(false);
    expect(isCeremonyTail('iv')).toBe(false);
  });
});
