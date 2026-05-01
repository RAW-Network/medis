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
const UX = {
  hideGraceMs: 1200,
  hideAfterMs: 650,
  throttleMs: 90,
  stuckWarnMs: 15000,
  stuckPulseMs: 1200,
  regressThreshold: 10
};

/* ── Internal State ── */
const _p = {
  visible: false,
  lastAt: 0,
  lastPercent: null,
  lastBase: '',
  hideTimer: null,
  raf: 0,
  pending: null,
  lastRenderAt: 0
};

/* ── Private helpers ── */

/** Show the progress bar container */
function _showProgressUI() {
  if (!_progressContainer) return;
  if (!_p.visible) {
    _progressContainer.style.display = 'block';
    _p.visible = true;
  }
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
  _p.pending = null;
  _p.lastRenderAt = 0;
}

/** Schedule hiding the progress bar when there are no active downloads */
function _scheduleHideIfIdle() {
  if (_p.hideTimer) clearTimeout(_p.hideTimer);
  const now = Date.now();
  const since = now - (_p.lastAt || 0);
  const downloading = getState('downloadingCount');

  if (downloading > 0) return;
  if (since < UX.hideGraceMs) {
    _p.hideTimer = setTimeout(_scheduleHideIfIdle, UX.hideGraceMs - since + 10);
    return;
  }

  _p.hideTimer = setTimeout(() => {
    const dl2 = getState('downloadingCount');
    const since2 = Date.now() - (_p.lastAt || 0);
    if (dl2 === 0 && since2 >= UX.hideGraceMs) _hideProgressUI();
  }, UX.hideAfterMs);
}

/** Apply a progress render to the DOM */
function _applyRender(p, base) {
  _showProgressUI();
  _progressFill.style.width = `${p}%`;
  if (_progressBar) _progressBar.setAttribute('aria-valuenow', String(p));
  _progressText.textContent = `${base} ${p}%`;
}

/** Throttle-aware commit of progress updates */
function _commitProgress(p, base) {
  const now = Date.now();
  const delta = now - _p.lastRenderAt;
  if (delta < UX.throttleMs) {
    _p.pending = { p, base };
    if (!_p.raf) {
      _p.raf = requestAnimationFrame(() => {
        _p.raf = 0;
        const wait = UX.throttleMs - (Date.now() - _p.lastRenderAt);
        setTimeout(() => {
          const pend = _p.pending;
          _p.pending = null;
          if (!pend) return;
          _p.lastRenderAt = Date.now();
          _applyRender(pend.p, pend.base);
        }, Math.max(0, wait));
      });
    }
    return;
  }
  _p.lastRenderAt = now;
  _applyRender(p, base);
}

/** Process an incoming progress update */
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

  if (_p.lastPercent !== null && p + UX.regressThreshold < _p.lastPercent) {
    _p.lastPercent = null;
    _p.lastBase = '';
    _showProgressUI();
    _progressFill.style.width = '0%';
    if (_progressBar) _progressBar.setAttribute('aria-valuenow', '0');
  }

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

  _commitProgress(p, base);
}

/** Stuck-download watchdog that pulses progress when no updates arrive */
function _startStuckWatchdog() {
  setInterval(() => {
    const downloading = getState('downloadingCount');
    if (downloading <= 0) return;
    if (!_p.visible) _showProgressUI();

    const now = Date.now();
    const since = now - (_p.lastAt || 0);
    if (since < UX.stuckWarnMs) return;

    let p = _p.lastPercent;
    if (p === null) p = 1;
    const pulse = Math.min(100, Math.max(0,
      p + (Math.floor((since - UX.stuckWarnMs) / UX.stuckPulseMs) % 2)
    ));
    const base = _p.lastBase || 'Downloading video';
    _commitProgress(pulse, base);
  }, 1500);
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

  // React to status changes
  subscribe('status:updated', (state) => {
    _downloadingCountEl.textContent = state.downloadingCount;
  });

  // React to completed count changes
  subscribe('videos:updated', (state) => {
    _completedCountEl.textContent = state.completedCount;
  });

  // React to progress updates from WebSocket
  subscribe('progress:updated', (state) => {
    _setProgress(state.progressPercent, state.progressMessage);
  });

  // React to idle signal (download done or no active)
  subscribe('progress:idle', () => {
    _scheduleHideIfIdle();
  });

  // Show progress bar if downloads are active when WS reconnects
  subscribe('progress:show', () => {
    if (getState('downloadingCount') > 0) _showProgressUI();
  });

  _startStuckWatchdog();
}
