// The two halves of the character screen each had their own copy of these maps
// and had drifted apart. These tests pin the words so a future edit to one
// platform can't quietly re-open the gap.
import {
  alignmentLabel,
  originLabel,
  ALIGNMENT_LABELS,
  ORIGIN_LABELS,
} from '../../src/lib/characterTaxonomy';

describe('alignmentLabel', () => {
  it('names the three alignments', () => {
    expect(alignmentLabel('good')).toBe('Hero');
    expect(alignmentLabel('bad')).toBe('Villain');
  });

  it('calls neutral "Neutral" on every platform', () => {
    // Web used to say "Anti-Hero" here while native said "Neutral" — 919
    // characters reading differently depending on the device. "Neutral" is the
    // one that is never a claim the data can't support.
    expect(alignmentLabel('neutral')).toBe('Neutral');
  });

  it('is forgiving about case and padding', () => {
    expect(alignmentLabel('  Good ')).toBe('Hero');
    expect(alignmentLabel('BAD')).toBe('Villain');
  });

  it('returns null for anything unrecognised', () => {
    expect(alignmentLabel(null)).toBeNull();
    expect(alignmentLabel(undefined)).toBeNull();
    expect(alignmentLabel('')).toBeNull();
    expect(alignmentLabel('chaotic good')).toBeNull();
  });
});

describe('originLabel', () => {
  it('calls the training origin "Trained" on every platform', () => {
    // The other divergence: native said "Training".
    expect(originLabel('training')).toBe('Trained');
  });

  it('names the rest of the origins', () => {
    expect(originLabel('mutant')).toBe('Mutant');
    expect(originLabel('god/eternal')).toBe('Eternal');
    expect(originLabel('inhuman')).toBe('Inhuman');
  });

  it('returns null for anything unrecognised', () => {
    expect(originLabel('sorcery')).toBeNull();
    expect(originLabel(null)).toBeNull();
  });
});

describe('the maps themselves', () => {
  it('has no empty labels', () => {
    for (const label of [...Object.values(ALIGNMENT_LABELS), ...Object.values(ORIGIN_LABELS)]) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('keys are lowercase, since lookup lowercases the input', () => {
    for (const key of [...Object.keys(ALIGNMENT_LABELS), ...Object.keys(ORIGIN_LABELS)]) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});
