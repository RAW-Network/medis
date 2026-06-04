// components/Header.js - Manages status badges and progress bar

import { $ } from '../utils/dom.js';
import { normalizeSpaces, stripAllPercents } from '../utils/format.js';
import { getState, subscribe } from '../state/store.js';

/* ── DOM refs ── */
/** @type {HTMLElement} */ let _downloadingCountEl;
/** @type {HTMLElement} */ let _completedCountEl;
/** @type {HTMLElement} */ let _progressContainer;
/** @type {HTMLElement} */ let _progressBar;
/** @type {HTMLElement} */ let _progressFill;
/** @type {HTMLElement} */ let _progressText;

/* ── Constants ── */
const HIDE_GRACE_MS = 1200;
const HIDE_AFTER_MS = 600;
const THROTTLE_MS = 100;
const REGRESS_THRESHOLD = 10;

/* ── Internal State ── */
const _p = {
  visible: false,
  lastAt: 0,
  lastPercent: null,
  lastBase: '',
  hideTimer: null,
  lastRenderAt: 0
};

/* ── Private helpers ── */

/** Show the progress bar container */
function _showProgressUI() {
  if (!_progressContainer || _p.visible) return;
  _progressContainer.style.display = 'block';
  _p.visible = true;
}

/** Hide the progress bar and reset internal state */
function _hideProgressUI() {
  if (!_progressContainer) return;
  _progressContainer.style.display = 'none';
  _progressFill.style.width = '0%';
  if (_progressBar) _progressBar.setAttribute('aria-valuenow', '0');
  _progressText.textContent = 'Preparing...';
  _p.visible = false;
  _p.lastPercent = null;
  _p.lastBase = '';
  _p.lastRenderAt = 0;
}

/** Schedule hiding the progress bar when idle */
function _scheduleHideIfIdle() {
  if (_p.hideTimer) clearTimeout(_p.hideTimer);

  const downloading = getState('downloadingCount');
  if (downloading > 0) return;

  const since = Date.now() - (_p.lastAt || 0);
  if (since < HIDE_GRACE_MS) {
    _p.hideTimer = setTimeout(_scheduleHideIfIdle, HIDE_GRACE_MS - since + 10);
    return;
  }

  _p.hideTimer = setTimeout(() => {
    if (getState('downloadingCount') === 0) _hideProgressUI();
  }, HIDE_AFTER_MS);
}

/** Apply a progress render to the DOM (throttled) */
function _setProgress(percent, message) {
  if (!_progressContainer) return;

  const now = Date.now();
  const rawMsg = normalizeSpaces(message || 'Working...');
  const base = stripAllPercents(rawMsg) || 'Working...';

  const n = Number(percent);
  const valid = !(percent === undefined || percent === null || Number.isNaN(n));

  if (!valid) {
    _showProgressUI();
    _progressFill.style.width = '0%';
    if (_progressBar) _progressBar.setAttribute('aria-valuenow', '0');
    _progressText.textContent = base;
    _p.lastAt = now;
    _p.lastPercent = null;
    _p.lastBase = base;
    return;
  }

  let p = Math.max(0, Math.min(100, Math.round(n)));

  // Reset if progress regresses significantly (new video starting)
  if (_p.lastPercent !== null && p + REGRESS_THRESHOLD < _p.lastPercent) {
    _p.lastPercent = null;
    _p.lastBase = '';
    _showProgressUI();
    _progressFill.style.width = '0%';
    if (_progressBar) _progressBar.setAttribute('aria-valuenow', '0');
  }

  // Don't allow minor regressions
  if (_p.lastPercent !== null && p < _p.lastPercent) {
    p = _p.lastPercent;
  }

  _p.lastAt = now;
  _p.lastPercent = p;
  _p.lastBase = base;

  if (_p.hideTimer) {
    clearTimeout(_p.hideTimer);
    _p.hideTimer = null;
  }

  // Throttle DOM updates
  if (now - _p.lastRenderAt < THROTTLE_MS) return;
  _p.lastRenderAt = now;

  _showProgressUI();
  _progressFill.style.width = `${p}%`;
  if (_progressBar) _progressBar.setAttribute('aria-valuenow', String(p));
  _progressText.textContent = `${base} ${p}%`;
}

/* ── Public API ── */

/** Initialise the Header component */
export function initHeader() {
  _downloadingCountEl = $('downloading-count');
  _completedCountEl   = $('completed-count');
  _progressContainer  = $('progress-bar-container');
  _progressBar        = _progressContainer ? _progressContainer.querySelector('.progress-bar') : null;
  _progressFill       = $('progress-bar-inner');
  _progressText       = $('progress-text');

  subscribe('status:updated', (state) => {
    _downloadingCountEl.textContent = state.downloadingCount;
  });

  subscribe('videos:updated', (state) => {
    _completedCountEl.textContent = state.completedCount;
  });

  subscribe('progress:updated', (state) => {
    _setProgress(state.progressPercent, state.progressMessage);
  });

  subscribe('progress:idle', () => {
    _scheduleHideIfIdle();
  });

  subscribe('progress:show', () => {
    if (getState('downloadingCount') > 0) _showProgressUI();
  });
}
