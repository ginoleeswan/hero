import { addToSide, removeFromSide, canBattle, derivePublisher, MAX_SIDE, type PickedHero } from '../../src/lib/battleBuilderState';

const h = (id: string, publisher: string | null = 'Marvel Comics'): PickedHero => ({ id, name: id, publisher });

describe('addToSide', () => {
  it('appends a hero to the side', () => {
    expect(addToSide([h('a')], [], h('b')).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('is a no-op when the side is full (5)', () => {
    const full = ['1', '2', '3', '4', '5'].map((i) => h(i));
    expect(addToSide(full, [], h('6'))).toBe(full); // unchanged reference
  });
  it('is a no-op when the hero is already on this side', () => {
    const side = [h('a')];
    expect(addToSide(side, [], h('a'))).toBe(side);
  });
  it('is a no-op when the hero is already on the other side', () => {
    const side = [h('a')];
    expect(addToSide(side, [h('x')], h('x'))).toBe(side);
  });
});

describe('removeFromSide', () => {
  it('removes the hero by id', () => {
    expect(removeFromSide([h('a'), h('b')], 'a').map((x) => x.id)).toEqual(['b']);
  });
});

describe('canBattle', () => {
  it('is false until both sides have at least one', () => {
    expect(canBattle([], [h('b')])).toBe(false);
    expect(canBattle([h('a')], [])).toBe(false);
    expect(canBattle([h('a')], [h('b')])).toBe(true);
  });
});

describe('derivePublisher', () => {
  it('returns null for fewer than two heroes', () => {
    expect(derivePublisher([h('a', 'DC Comics')])).toBeNull();
  });
  it('returns the shared publisher when all match', () => {
    expect(derivePublisher([h('a', 'DC Comics'), h('b', 'DC Entertainment')])).toBe('dc');
    expect(derivePublisher([h('a', 'Marvel Comics'), h('b', 'Marvel')])).toBe('marvel');
  });
  it('returns null for a mixed roster', () => {
    expect(derivePublisher([h('a', 'DC Comics'), h('b', 'Marvel Comics')])).toBeNull();
  });
  it('returns null when the shared publisher is neither Marvel nor DC', () => {
    expect(derivePublisher([h('a', 'Image'), h('b', 'Image')])).toBeNull();
  });

  it('MAX_SIDE is 5', () => {
    expect(MAX_SIDE).toBe(5);
  });
});
