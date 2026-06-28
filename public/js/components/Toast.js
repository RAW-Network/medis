/** Toast notification component for displaying temporary success or error messages */
import { $ } from '../utils/dom.js';
import { ICONS } from '../utils/icons.js';

let _container = null;

/** Maximum visible toasts at once */
const MAX_TOASTS = 3;

/** Icon mapping for toast types */
const ICON_MAP = {
  success: ICONS.success,
  error: ICONS.error,
  info: ICONS.info
};

/** Initialise the toast system by caching the container element */
export function initToast() {
  _container = $('toast-container');
}

/** Show a toast notification */
export function showToast(message, type = 'info', duration = 4000) {
  if (!_container) _container = $('toast-container');
  if (!_container) return;

  _enforceMaxToasts();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${ICON_MAP[type] || ICONS.info}</div>
    <div class="toast-content">${message}</div>
  `;

  _container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  if (duration > 0) {
    setTimeout(() => _removeToast(toast), duration);
  }
}

/** Remove a toast with fade-out */
function _removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.remove('show');
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 250);
}

/** Enforce max toast limit — remove oldest if over limit */
function _enforceMaxToasts() {
  const toasts = _container.querySelectorAll('.toast');
  if (toasts.length >= MAX_TOASTS) {
    _removeToast(toasts[0]);
  }
}
