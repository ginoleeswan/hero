// src/constants/arenaType.ts — the Arena tab's two heading levels.
//
// One scroll of that tab used to carry four heading treatments: a gold eyebrow
// at 11/4, a muted small-caps at 11/2.4, a bold gold small-caps at 11/1, and a
// faint semibold small-caps at 11/1.6 — near-identical sizes at four different
// letterspacings in two weights, which reads as inconsistency rather than as
// hierarchy. Same size means same level; if two labels are the same level they
// should be the same label.
//
// SECTION  a Flame title that opens an act ("Make a fight", "Most Feared")
// SUBHEAD  small caps naming a block inside an act ("What's left today")
//
// Colour is deliberately NOT here: the level is the type, the emphasis is the
// colour, and the two vary independently (gold for the live thing, muted for
// the label beside it).
export const SECTION = {
  fontFamily: 'Flame-Regular',
  fontSize: 23,
  lineHeight: 32,
} as const;

export const SUBHEAD = {
  fontFamily: 'Nunito_600SemiBold',
  fontSize: 11,
  letterSpacing: 2,
  textTransform: 'uppercase',
} as const;
