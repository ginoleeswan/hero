// A value is "blank" using the same sentinels the character screen treats as
// empty ('-' / 'null' / whitespace), so inline edit only marks genuinely-absent
// fields as needing input.
export function isBlankValue(v?: string | null): boolean {
  return !v || v === '-' || v === 'null' || v.trim() === '';
}
