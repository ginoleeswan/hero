// This module exists because the two halves of the character screen disagreed
// about what counts as a real value, and 426 characters showed a literal
// "No alter egos found." on native as a result. The cases below are the ones
// that were actually reaching users.
import { isPresentableFact, cleanFact, JUNK_FACT_VALUES } from '../../src/lib/characterFacts';

describe('isPresentableFact', () => {
  it('keeps real values', () => {
    expect(isPresentableFact('Bruce Wayne')).toBe(true);
    expect(isPresentableFact('Gotham City')).toBe(true);
    // A real fact that merely looks like a placeholder.
    expect(isPresentableFact('Unknown Soldier')).toBe(true);
  });

  it('rejects the empty cases', () => {
    expect(isPresentableFact(null)).toBe(false);
    expect(isPresentableFact(undefined)).toBe(false);
    expect(isPresentableFact('')).toBe(false);
    expect(isPresentableFact('   ')).toBe(false);
  });

  it.each([...JUNK_FACT_VALUES])('rejects the placeholder %p', (junk) => {
    expect(isPresentableFact(junk)).toBe(false);
  });

  it('rejects placeholders regardless of case or padding', () => {
    // The native half compared exact strings, so ' Unknown ' and 'NONE' slipped
    // through even where the value itself was recognised.
    expect(isPresentableFact('  Unknown  ')).toBe(false);
    expect(isPresentableFact('NONE')).toBe(false);
    expect(isPresentableFact('N/A')).toBe(false);
    expect(isPresentableFact('No Alter Egos Found.')).toBe(false);
  });

  it('rejects punctuation-only leftovers', () => {
    // These come from joining two empty values, e.g. height "– / –".
    expect(isPresentableFact('-')).toBe(false);
    expect(isPresentableFact('–')).toBe(false);
    expect(isPresentableFact(' / ')).toBe(false);
    expect(isPresentableFact('- / -')).toBe(false);
  });
});

describe('cleanFact', () => {
  it('trims what it keeps', () => {
    expect(cleanFact('  Bruce Wayne  ')).toBe('Bruce Wayne');
  });

  it('returns null for anything not worth showing', () => {
    expect(cleanFact('Unknown')).toBeNull();
    expect(cleanFact('')).toBeNull();
    expect(cleanFact(null)).toBeNull();
  });
});
