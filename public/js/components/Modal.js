/** Modal component for displaying confirmation dialogs to the user */
import { $ } from '../utils/dom.js';
import { ICONS } from '../utils/icons.js';

/** @type {HTMLElement} */ let _overlay;
/** @type {HTMLElement} */ let _text;
/** @type {HTMLElement} */ let _cancelBtn;
/** @type {HTMLElement} */ let _confirmBtn;

/** Initialise the modal by caching DOM references */
export function initModal() {
  _overlay    = $('confirm-modal');
  _text       = $('modal-text');
  _cancelBtn  = $('modal-cancel-btn');
  _confirmBtn = $('modal-confirm-btn');
}

/** Show the confirmation modal and wait for user response */
export function showConfirmModal(videoTitle) {
  return new Promise((resolve) => {
    _text.innerHTML = `
      <div class="modal-icon-wrapper">
        ${ICONS.modalTrash}
      </div>
      <h3 class="custom-modal-title">Delete Video?</h3>
      <p class="modal-message">
        This action is permanent and cannot be undone.
        <span class="video-highlight">${videoTitle}</span>
      </p>
    `;

    _overlay.classList.remove('hidden');
    requestAnimationFrame(() => _overlay.classList.add('visible'));
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    const close = (ok) => {
      _overlay.classList.remove('visible');
      document.body.style.overflow = '';
      setTimeout(() => {
        _overlay.classList.add('hidden');
        resolve(ok);
      }, 220);
    };

    const onOverlayClick = (e) => {
      if (e.target === _overlay) close(false);
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') close(false);
    };

    _overlay.addEventListener('click', onOverlayClick, { once: true });
    document.addEventListener('keydown', onEsc, { once: true });

    _cancelBtn.onclick  = () => close(false);
    _confirmBtn.onclick = () => close(true);
  });
}
