import { crestMonogram, mixHex } from '../../../src/components/family/HouseCrest';

describe('crestMonogram', () => {
  it('drops the leading title so the letter is the name itself', () => {
    expect(crestMonogram('House Targaryen')).toBe('T');
    expect(crestMonogram('Clan Umber')).toBe('U');
    expect(crestMonogram('The Night’s Watch')).toBe('N');
  });

  it('falls back to the first letter when there is no title', () => {
    expect(crestMonogram('Dorne')).toBe('D');
  });

  it('never returns an empty mark', () => {
    expect(crestMonogram('')).toBe('?');
    expect(crestMonogram('House ')).toBe('H');
  });
});

describe('mixHex', () => {
  it('blends toward the target', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('expands shorthand', () => {
    expect(mixHex('#f00', '#f00', 0.5)).toBe('#ff0000');
  });

  it('passes non-hex through rather than emitting garbage', () => {
    expect(mixHex('rgba(0,0,0,0.5)', '#ffffff', 0.5)).toBe('rgba(0,0,0,0.5)');
  });
});
