import { isPresentableFact } from '../characterFacts';

// A value is "blank" using the same sentinels the character screen treats as
// empty, so inline edit only marks genuinely-absent fields as needing input.
//
// That claim used to be enforced by a copy-pasted check that had fallen behind:
// it knew '-' and 'null' but not 'Unknown' or 'None', so a field the character
// page had started hiding still didn't count as missing here — the reader saw a
// gap and the contribute UI didn't offer to fill it. It now shares the
// definition rather than describing it.
export function isBlankValue(v?: string | null): boolean {
  return !isPresentableFact(v);
}
