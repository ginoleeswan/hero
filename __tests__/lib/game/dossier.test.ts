import { redactName, firstSentences, buildDossier } from '../../../src/lib/game/dossier';

describe('redactName', () => {
  it('blanks the name, real name and aliases (case-insensitive)', () => {
    const out = redactName(
      'Captain Cold, Leonard Snart, is a villain. Snart leads the Rogues with his cold gun.',
      { name: 'Captain Cold', fullName: 'Leonard Snart', aliases: ['Citizen Cold'] },
    );
    expect(out).not.toMatch(/Captain|Cold|Leonard|Snart/i);
    expect(out).toContain('█');
    expect(out).toContain('Rogues'); // non-name words survive
  });

  it('redacts the name even at the start of the bio', () => {
    const out = redactName('Caliban is a mutant that can sense other mutants.', {
      name: 'Caliban',
      fullName: null,
      aliases: [],
    });
    expect(out.startsWith('███')).toBe(true);
    expect(out).toContain('mutant');
  });
});

describe('firstSentences', () => {
  it('keeps whole sentences up to the length budget', () => {
    const text = 'One sentence here. A second, longer sentence follows. And a third.';
    const out = firstSentences(text, 60);
    expect(out).toBe('One sentence here. A second, longer sentence follows.');
  });
  it('falls back to the raw text when there is no terminator', () => {
    expect(firstSentences('no punctuation here')).toBe('no punctuation here');
  });
});

describe('buildDossier', () => {
  it('returns a redacted opening line', () => {
    const line = buildDossier({
      summary: 'Professor Charles Xavier is the creator of the X-Men. He is a powerful telepath.',
      name: 'Professor X',
      fullName: 'Charles Francis Xavier',
      aliases: ['Professor Xavier', 'Charles Xavier'],
    });
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/Charles|Xavier/i);
    expect(line).toContain('creator of the');
  });
  it('returns null when there is no summary', () => {
    expect(buildDossier({ summary: null, name: 'X', fullName: null, aliases: [] })).toBeNull();
    expect(buildDossier({ summary: '   ', name: 'X', fullName: null, aliases: [] })).toBeNull();
  });
});
