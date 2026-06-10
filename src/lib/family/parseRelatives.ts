// src/lib/family/parseRelatives.ts
import type { ParsedRelative } from './types';

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
      if (parts.length === 1) {
        role = parts[0];
      } else if (parts.length > 1) {
        role = parts[parts.length - 1];
        alias = parts.slice(0, -1).join(', ');
      }
    }

    if (name === '' || JUNK.has(name.toLowerCase())) continue;
    result.push({ name, alias, role, position: position++ });
  }
  return result;
}
