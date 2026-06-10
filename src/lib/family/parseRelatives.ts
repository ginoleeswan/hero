// src/lib/family/parseRelatives.ts
import type { ParsedRelative } from './types';
import { classifyRole } from './classifyRole';

const JUNK = new Set(['', '-', 'null', 'n/a', 'none', 'unknown']);

/** Split on top-level commas/semicolons, ignoring delimiters inside parentheses. */
function splitTopLevel(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * A leading paren segment is an alias (not the relationship) when it carries no
 * relationship or status keyword of its own — e.g. "Kara Zor-El" in
 * "(Kara Zor-El, cousin)", but NOT "father" in "(father, deceased)".
 */
function isAliasSegment(seg: string): boolean {
  const c = classifyRole(seg);
  return c.relation === 'other' && c.status === null;
}

export function parseRelatives(raw: string | null | undefined): ParsedRelative[] {
  if (!raw) return [];
  const result: ParsedRelative[] = [];
  let position = 0;
  for (const entry of splitTopLevel(raw)) {
    const trimmed = entry.trim();
    if (JUNK.has(trimmed.toLowerCase())) continue;

    const open = trimmed.indexOf('(');
    let name = trimmed;
    let alias: string | null = null;
    let role = '';

    if (open !== -1) {
      name = trimmed.slice(0, open).trim();
      const close = trimmed.lastIndexOf(')');
      const inner = (close > open ? trimmed.slice(open + 1, close) : trimmed.slice(open + 1)).trim();
      const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1 && isAliasSegment(parts[0])) {
        alias = parts[0];
        role = parts.slice(1).join(', ');
      } else {
        role = parts.join(', ');
      }
    }

    if (name === '' || JUNK.has(name.toLowerCase())) continue;
    result.push({ name, alias, role, position: position++ });
  }
  return result;
}
