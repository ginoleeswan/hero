import { parseYear, reignLine, lifeLine, nodeDates } from '../../../src/lib/family/lifespan';

describe('parseYear', () => {
  it('reads a year and its era', () => {
    expect(parseYear('48 AC')).toBe(48);
    expect(parseYear('103AC')).toBe(103);
  });

  it('runs counting-back eras negative so ranges do not invert', () => {
    expect(parseYear('3 BC')).toBe(-3);
    expect(parseYear('19 BBY')).toBe(-19);
  });

  it('tolerates approximation markers', () => {
    expect(parseYear('c. 132 AC')).toBe(132);
    expect(parseYear('circa 132 AC')).toBe(132);
  });

  it('gives up rather than guessing', () => {
    expect(parseYear('the Long Night')).toBeNull();
    expect(parseYear(null)).toBeNull();
    expect(parseYear('')).toBeNull();
  });
});

describe('reignLine', () => {
  it('collapses a shared era and counts the years', () => {
    expect(reignLine({ reign_start: '48 AC', reign_end: '103 AC' })).toBe(
      'Reigned 48–103 AC · 55 years',
    );
  });

  it('singularises a one-year reign', () => {
    expect(reignLine({ reign_start: '129 AC', reign_end: '130 AC' })).toBe(
      'Reigned 129–130 AC · 1 year',
    );
  });

  it('keeps both eras when they differ', () => {
    expect(reignLine({ reign_start: '3 BC', reign_end: '37 AC' })).toBe(
      'Reigned 3 BC – 37 AC · 40 years',
    );
  });

  it('states an open reign instead of inventing an end', () => {
    expect(reignLine({ reign_start: '283 AC' })).toBe('Reigned from 283 AC');
    expect(reignLine({ reign_end: '283 AC' })).toBe('Reigned until 283 AC');
  });

  it('drops a duration it cannot compute', () => {
    expect(reignLine({ reign_start: 'the Long Night', reign_end: '10 AC' })).toBe(
      'Reigned the Long Night – 10 AC',
    );
  });

  it('is null with nothing to say', () => {
    expect(reignLine({})).toBeNull();
    expect(reignLine({ reign_start: '  ' })).toBeNull();
  });
});

describe('lifeLine', () => {
  it('renders a full lifespan', () => {
    expect(lifeLine({ born: '245 AC', died: '284 AC' })).toBe('245–284 AC');
  });

  it('marks a half-known life rather than hiding it', () => {
    expect(lifeLine({ born: '245 AC' })).toBe('b. 245 AC');
    expect(lifeLine({ died: '284 AC' })).toBe('d. 284 AC');
  });

  it('is null when nothing is recorded', () => {
    expect(lifeLine({})).toBeNull();
  });
});

describe('nodeDates', () => {
  it('prefers the reign — the more telling fact in a dynasty', () => {
    expect(
      nodeDates({ reign_start: '48 AC', reign_end: '103 AC', born: '34 AC', died: '103 AC' }),
    ).toBe('48–103 AC');
  });

  it('falls back to the lifespan', () => {
    expect(nodeDates({ born: '245 AC', died: '284 AC' })).toBe('245–284 AC');
  });

  it('carries no verb or duration — there is no room', () => {
    expect(nodeDates({ reign_start: '48 AC', reign_end: '103 AC' })).not.toMatch(/Reigned|years/);
  });

  it('is null when the record is empty', () => {
    expect(nodeDates({})).toBeNull();
  });
});
