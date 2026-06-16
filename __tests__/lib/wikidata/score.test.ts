import {
  scoreCandidate,
  resolveHero,
  type HeroHints,
  type QidCandidate,
} from '../../../src/lib/wikidata/score';

const hero: HeroHints = {
  name: 'Batman',
  aliases: ['Bruce Wayne', 'The Dark Knight'],
  publisher: 'DC Comics',
  firstAppearanceYear: 1939,
  creators: ['Bob Kane', 'Bill Finger'],
};

function cand(over: Partial<QidCandidate>): QidCandidate {
  return {
    qid: 'Q1',
    label: 'Batman',
    description: null,
    publisherLabels: [],
    inceptionYear: null,
    creatorLabels: [],
    ...over,
  };
}

describe('scoreCandidate', () => {
  it('rewards exact name + publisher + year + creators', () => {
    const s = scoreCandidate(
      hero,
      cand({
        label: 'Batman',
        publisherLabels: ['DC Comics'],
        inceptionYear: 1939,
        creatorLabels: ['Bob Kane', 'Bill Finger'],
      }),
    );
    expect(s).toBeGreaterThanOrEqual(1.0);
  });

  it('gives little to a same-name character from another publisher and era', () => {
    const s = scoreCandidate(
      hero,
      cand({
        label: 'Batman',
        publisherLabels: ['Archie Comics'],
        inceptionYear: 2005,
        creatorLabels: [],
      }),
    );
    expect(s).toBeLessThan(0.35);
  });

  it('matches an alias when the label is the alter ego', () => {
    const s = scoreCandidate(hero, cand({ label: 'Bruce Wayne', publisherLabels: [] }));
    expect(s).toBeGreaterThanOrEqual(0.1);
  });
});

describe('resolveHero', () => {
  it('resolves a clear winner above threshold with a gap', () => {
    const out = resolveHero(hero, [
      cand({
        qid: 'Q1',
        label: 'Batman',
        publisherLabels: ['DC Comics'],
        inceptionYear: 1939,
        creatorLabels: ['Bob Kane'],
      }),
      cand({ qid: 'Q2', label: 'Batman', publisherLabels: ['Archie Comics'], inceptionYear: 2010 }),
    ]);
    expect(out.tier).toBe('resolved');
    expect(out.qid).toBe('Q1');
  });

  it('marks ambiguous when two strong candidates are close', () => {
    const out = resolveHero(hero, [
      cand({ qid: 'Q1', label: 'Batman', publisherLabels: ['DC Comics'] }),
      cand({ qid: 'Q2', label: 'Batman', publisherLabels: ['DC Comics'] }),
    ]);
    expect(out.tier).toBe('ambiguous');
    expect(out.qid).toBeNull();
    expect(out.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('marks unresolved when nothing is plausible', () => {
    const out = resolveHero(hero, [
      cand({ qid: 'Q9', label: 'Unrelated', publisherLabels: ['Other'], inceptionYear: 2020 }),
    ]);
    expect(out.tier).toBe('unresolved');
  });

  it('marks unresolved for no candidates', () => {
    expect(resolveHero(hero, []).tier).toBe('unresolved');
  });
});
