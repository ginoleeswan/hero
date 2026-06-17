import { EDITABLE_FIELDS, type EditableFieldDef } from '../db/contributions';

// Which contributor-editable fields a hero is missing — the engine behind the
// "Help complete this page" card. A field is "blank" using the same sentinels
// the character screen treats as empty ('-' / 'null' / whitespace), so the card
// only ever asks for genuinely-absent data.

export function isBlankValue(v?: string | null): boolean {
  return !v || v === '-' || v === 'null' || v.trim() === '';
}

/** The editable fields that are currently empty for this hero. */
export function missingFields(values: Record<string, string | null | undefined>): EditableFieldDef[] {
  return EDITABLE_FIELDS.filter((f) => isBlankValue(values[f.field]));
}

/** The editable fields that already have a value (candidates for "suggest a fix"). */
export function presentFields(values: Record<string, string | null | undefined>): EditableFieldDef[] {
  return EDITABLE_FIELDS.filter((f) => !isBlankValue(values[f.field]));
}
