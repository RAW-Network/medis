// utils/clipboard.js - Cross-browser clipboard write utility

/**
 * Copy text to the clipboard. Uses the modern Clipboard API when available,
 * falls back to the legacy execCommand approach.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback for non-secure contexts
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_e) { /* swallow */ }

  ta.remove();
  return ok;
}
