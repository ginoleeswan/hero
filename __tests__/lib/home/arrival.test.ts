import { arrivalSubject } from '../../../src/lib/home/arrival';

describe('arrivalSubject', () => {
  it('accepts the three hero id shapes the catalogue actually uses', () => {
    expect(arrivalSubject('cv-16423')).toEqual({ kind: 'hero', id: 'cv-16423' });
    expect(arrivalSubject('h_3bdf77b4-00e2-4ea6-86d2-b76d595ecbe6')).toEqual({
      kind: 'hero',
      id: 'h_3bdf77b4-00e2-4ea6-86d2-b76d595ecbe6',
    });
    expect(arrivalSubject('485')).toEqual({ kind: 'hero', id: '485' });
  });

  it('declines a matchup token rather than guessing which half is which', () => {
    // "cv-1-cv-2" has three plausible splits. Those posts deep-link to /compare
    // already, so a wrong lead would be strictly worse than none.
    expect(arrivalSubject('cv-1-cv-2')).toBeNull();
  });

  it('declines campaign-ish tokens that are not ids', () => {
    expect(arrivalSubject('bio')).toBeNull();
    expect(arrivalSubject('jul-promote')).toBeNull();
    expect(arrivalSubject('untitled')).toBeNull();
  });

  it('declines empty and absent input', () => {
    expect(arrivalSubject(null)).toBeNull();
    expect(arrivalSubject(undefined)).toBeNull();
    expect(arrivalSubject('   ')).toBeNull();
  });

  it('does not accept something merely containing an id', () => {
    // This value reaches a DB lookup and an href, so anchoring matters.
    expect(arrivalSubject('x-cv-1')).toBeNull();
    expect(arrivalSubject('cv-1;drop')).toBeNull();
  });

  it('rejects an h_ token whose uuid is malformed', () => {
    expect(arrivalSubject('h_notauuid')).toBeNull();
    expect(arrivalSubject('h_3bdf77b4-00e2-4ea6-86d2')).toBeNull();
  });

  it('rejects an implausibly long numeric id', () => {
    expect(arrivalSubject('12345678901234')).toBeNull();
  });
});
