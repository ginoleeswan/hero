import { parseIds } from '../../src/lib/parseIds';

describe('parseIds', () => {
  it('splits a comma list, trims, drops empties', () => {
    expect(parseIds('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });
  it('takes the first when given an array param', () => {
    expect(parseIds(['x,y', 'z'])).toEqual(['x', 'y']);
  });
  it('returns [] for undefined or empty', () => {
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds('')).toEqual([]);
  });
  it('caps at 5', () => {
    expect(parseIds('1,2,3,4,5,6')).toHaveLength(5);
  });
});
