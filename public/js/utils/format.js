// utils/format.js - Text formatting utilities for progress messages

/** Collapse non-breaking spaces and multiple whitespace into single spaces */
export function normalizeSpaces(s) {
  return String(s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Remove all percentage tokens (e.g. "42%", "(85%)") from a string */
export function stripAllPercents(text) {
  const s = normalizeSpaces(text);
  const pct = '%％٪';
  const reParen = new RegExp(`\\(\\s*\\d{1,3}\\s*[${pct}]\\s*\\)`, 'g');
  const reToken = new RegExp(`\\d{1,3}\\s*[${pct}]`, 'g');
  return normalizeSpaces(s.replace(reParen, '').replace(reToken, ''));
}
