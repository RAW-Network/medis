/** Form component for handling input and submission of new download requests */
import { $ } from '../utils/dom.js';
import { triggerDownload } from '../api/client.js';
import { showToast } from './Toast.js';

/** @type {HTMLInputElement} */ let _input;
/** @type {HTMLButtonElement} */ let _btn;
/** @type {HTMLElement} */ let _loading;

/** Cooldown duration in milliseconds */
const COOLDOWN_MS = 3000;
let _cooldownTimer = null;

/** Submit the current URL for download */
async function _handleDownload() {
  const url = _input.value.trim();
  if (!url) {
    showToast('Please enter a video URL', 'error');
    return;
  }

  _btn.disabled = true;
  _loading.classList.remove('hidden');

  try {
    const result = await triggerDownload(url);
    showToast(result.message || 'Queued', 'info');
    _input.value = '';
    _startCooldown();
  } catch (error) {
    showToast(error.message, 'error');
    _btn.disabled = false;
  } finally {
    _loading.classList.add('hidden');
  }
}

/** Start a cooldown period after successful submission */
function _startCooldown() {
  if (_cooldownTimer) clearInterval(_cooldownTimer);

  let remaining = COOLDOWN_MS;
  _btn.classList.add('cooldown');
  _btn.querySelector('span').textContent = `Wait ${Math.ceil(remaining / 1000)}s`;

  _cooldownTimer = setInterval(() => {
    remaining -= 1000;
    if (remaining <= 0) {
      clearInterval(_cooldownTimer);
      _cooldownTimer = null;
      _btn.disabled = false;
      _btn.classList.remove('cooldown');
      _btn.querySelector('span').textContent = 'Download';
    } else {
      _btn.querySelector('span').textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
    }
  }, 1000);
}

/** Initialise the form by binding DOM elements and events */
export function initDownloadForm() {
  _input   = /** @type {HTMLInputElement} */ ($('video-url'));
  _btn     = /** @type {HTMLButtonElement} */ ($('download-btn'));
  _loading = $('loading-indicator');

  _btn.addEventListener('click', _handleDownload);
  _input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !_btn.disabled) _handleDownload();
  });
}
