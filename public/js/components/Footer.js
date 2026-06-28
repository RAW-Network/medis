/** Footer component for displaying application version and metadata */
import { $ } from '../utils/dom.js';
import { fetchVersion } from '../api/client.js';

/** localStorage key for cached version data */
const CACHE_KEY = 'medis_versions';

/** Initialise the footer and trigger version fetch */
export function initFooter() {
  const ytdlpEl = $('ytdlp-version');
  const medisEl = $('medis-version');

  // Restore from cache for instant display
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (ytdlpEl) ytdlpEl.textContent = data.ytdlp;
      if (medisEl) medisEl.textContent = data.medis;
    } catch (_e) { /* ignore corrupt cache */ }
  }

  // Fetch fresh version info
  _fetchAndDisplay(ytdlpEl, medisEl);
}

/** Fetch version data from the API and update DOM + cache */
async function _fetchAndDisplay(ytdlpEl, medisEl) {
  try {
    const data = await fetchVersion();
    if (ytdlpEl) ytdlpEl.textContent = data.ytdlp || 'unknown';
    if (medisEl) medisEl.textContent = data.medis || 'unknown';
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (_e) {
    // Silently fail — cached values (or "loading...") remain visible
  }
}
