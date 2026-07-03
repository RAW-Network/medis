/** Format utilities for formatting strings, times, and numbers */
/** Collapse non-breaking spaces and multiple whitespace into single spaces */
export function normalizeSpaces(s) {
  return String(s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Format speed in bytes/sec to a human readable format */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || isNaN(bytesPerSec) || bytesPerSec <= 0) return '';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Format ETA in seconds to a human readable format (e.g. 1m 30s) */
export function formatEta(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ${Math.round(seconds%60)}s`;
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round((seconds % 3600) % 60);
  return `${h}h ${m}m ${s}s`;
}

/** Remove all percentage tokens (e.g. "42%", "(85%)") from a string */
export function stripAllPercents(text) {
  const s = normalizeSpaces(text);
  const pct = '%％٪';
  const reParen = new RegExp(`\\(\\s*\\d{1,3}\\s*[${pct}]\\s*\\)`, 'g');
  const reToken = new RegExp(`\\d{1,3}\\s*[${pct}]`, 'g');
  return normalizeSpaces(s.replace(reParen, '').replace(reToken, ''));
}
