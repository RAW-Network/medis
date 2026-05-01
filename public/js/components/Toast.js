// components/Toast.js - Toast notification system

import { $ } from '../utils/dom.js';
import { ICONS } from '../utils/icons.js';

let _container = null;

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
export function showToast(message, type = 'info', duration = 4200) {
  if (!_container) _container = $('toast-container');
  if (!_container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${ICON_MAP[type] || ICONS.info}</div>
    <div class="toast-content">${message}</div>
  `;

  _container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 40);

  const removeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  };

  if (duration > 0) setTimeout(removeToast, duration);
}
