import { treeDisplayName } from '../../../src/lib/family/displayName';

describe('treeDisplayName', () => {
  it('drops the house name shared with the tree it appears in', () => {
    expect(treeDisplayName('Aegon III Targaryen', 'Aegon I Targaryen')).toBe('Aegon III');
    expect(treeDisplayName('Rhaenyra Targaryen', 'Aegon I Targaryen')).toBe('Rhaenyra');
  });

  it('keeps a house name that differs — that is where the bloodline leaves', () => {
    expect(treeDisplayName('Steffon Baratheon', 'Aegon I Targaryen')).toBe('Steffon Baratheon');
    expect(treeDisplayName('Alicent Hightower', 'Aegon I Targaryen')).toBe('Alicent Hightower');
  });

  it('keeps a bastard name, which is the whole point of one', () => {
    expect(treeDisplayName('Jon Snow', 'Eddard Stark')).toBe('Jon Snow');
    expect(treeDisplayName('Arya Stark', 'Eddard Stark')).toBe('Arya');
  });

  it('leaves single-word names alone', () => {
    expect(treeDisplayName('Bloodraven', 'Aegon I Targaryen')).toBe('Bloodraven');
    expect(treeDisplayName('Gendry', 'Robert Baratheon')).toBe('Gendry');
  });

  it('leaves everything alone when the hero has no house', () => {
    expect(treeDisplayName('Arya Stark', 'Hodor')).toBe('Arya Stark');
  });

  it('matches the house case-insensitively', () => {
    expect(treeDisplayName('Arya STARK', 'Eddard Stark')).toBe('Arya');
  });

  it('never returns an empty label', () => {
    expect(treeDisplayName('Targaryen', 'Aegon I Targaryen')).toBe('Targaryen');
  });
});
