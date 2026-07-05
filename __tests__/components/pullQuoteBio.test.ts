import { splitLeadSentence } from '../../src/components/character/PullQuoteBio';

describe('splitLeadSentence', () => {
  it('splits on the first sentence boundary', () => {
    const r = splitLeadSentence('Kara is brash. She fights crime. The end.');
    expect(r.lead).toBe('Kara is brash.');
    expect(r.rest).toBe('She fights crime. The end.');
  });
  it('keeps abbreviations like D.E.O. inside the lead (boundary needs space + capital)', () => {
    const r = splitLeadSentence('She works at the D.E.O. building daily. More text here.');
    // "D.E.O. building" is not a boundary (lowercase follows); "daily. More" is.
    expect(r.lead).toBe('She works at the D.E.O. building daily.');
    expect(r.rest).toBe('More text here.');
  });
  it('returns the whole text as lead when there is no boundary', () => {
    const r = splitLeadSentence('One long unpunctuated line');
    expect(r.lead).toBe('One long unpunctuated line');
    expect(r.rest).toBe('');
  });
  it('refuses oversized leads (>220 chars) and falls back to whole-text lead', () => {
    const long = `${'x'.repeat(230)}. Short tail.`;
    const r = splitLeadSentence(long);
    expect(r.rest).toBe('');
  });
});
