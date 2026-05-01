// components/DownloadForm.js - Handles URL input field and download button

import { $ } from '../utils/dom.js';
import { requestDownload } from '../api/client.js';
import { showToast } from './Toast.js';

/** @type {HTMLInputElement} */ let _input;
/** @type {HTMLButtonElement} */ let _btn;
/** @type {HTMLElement} */ let _loading;

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
    const result = await requestDownload(url);
    showToast(result.message || 'Queued', 'info');
    _input.value = '';
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    _btn.disabled = false;
    _loading.classList.add('hidden');
  }
}

/** Initialise the download form component */
export function initDownloadForm() {
  _input   = /** @type {HTMLInputElement} */ ($('video-url'));
  _btn     = /** @type {HTMLButtonElement} */ ($('download-btn'));
  _loading = $('loading-indicator');

  _btn.addEventListener('click', _handleDownload);
  _input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _handleDownload();
  });
}
