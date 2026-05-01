// components/VideoCard.js - Factory function for video card DOM elements

import { el } from '../utils/dom.js';
import { ICONS } from '../utils/icons.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from './Toast.js';
import { showConfirmModal } from './Modal.js';
import { deleteVideo } from '../api/client.js';
import { refreshVideos } from './VideoLibrary.js';

/** Replace a thumbnail placeholder with an inline video player */
function _playVideo(event) {
  const placeholder = /** @type {HTMLElement} */ (event.currentTarget);
  const videoSrc = placeholder.dataset.src;
  if (!videoSrc) return;

  const player = el('video', {
    className: 'card-video-player',
    attrs: { src: videoSrc, controls: '', autoplay: '', preload: 'auto' }
  });

  placeholder.parentNode.replaceChild(player, placeholder);
  player.focus();
}

/** Create a video card DOM element */
export function createVideoCard(video) {
  const card = el('div', {
    className: 'video-card',
    attrs: { id: `video-card-${video.id}` },
    dataset: { videoId: video.id }
  });

  // ── Thumbnail placeholder ──
  const placeholder = el('div', {
    className: 'card-video-placeholder',
    dataset: { src: `/api/stream/${video.filename}` }
  });

  if (video.thumbnailUrl && video.thumbnailUrl.trim() !== '') {
    placeholder.style.backgroundImage = `url('${video.thumbnailUrl}')`;
  } else {
    placeholder.classList.add('no-thumbnail');
  }

  const playIcon = el('div', { className: 'play-icon' });
  placeholder.appendChild(playIcon);
  placeholder.addEventListener('click', _playVideo);

  // ── Info section ──
  const info = el('div', { className: 'card-info' });

  const title = el('h3', { className: 'card-title', text: video.title || 'Untitled' });

  const date = el('p', { className: 'card-date' });
  const dt = video.createdAt ? new Date(video.createdAt) : null;
  date.textContent = dt && !isNaN(dt.getTime()) ? dt.toLocaleString() : '';

  // ── Actions ──
  const actions = el('div', { className: 'card-actions' });

  const copyBtn = _createCopyButton(video);
  const deleteBtn = _createDeleteButton(video, card);

  actions.append(copyBtn, deleteBtn);
  info.append(title, date, actions);
  card.append(placeholder, info);

  return card;
}

/** Create the "Copy" share-link button */
function _createCopyButton(video) {
  const btn = /** @type {HTMLButtonElement} */ (el('button', {
    className: 'action-btn copy-btn',
    html: ICONS.copy + ' <span>Copy</span>',
    attrs: { title: 'Copy Share Link', type: 'button' }
  }));

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    const shareLink = `${window.location.origin}/share/${video.id}`;
    try {
      const copied = await copyToClipboard(shareLink);
      if (!copied) throw new Error('copy failed');
      btn.disabled = true;
      btn.innerHTML = ICONS.copied + ' <span>Copied</span>';
      showToast('Link copied', 'success');
      setTimeout(() => {
        btn.innerHTML = ICONS.copy + ' <span>Copy</span>';
        btn.disabled = false;
      }, 1400);
    } catch (_e) {
      showToast('Failed to copy link', 'error');
    }
  });

  return btn;
}

/** Create the "Delete" button with confirmation modal */
function _createDeleteButton(video, card) {
  const btn = /** @type {HTMLButtonElement} */ (el('button', {
    className: 'action-btn delete-btn',
    html: ICONS.trash + ' <span>Delete</span>',
    attrs: { title: 'Delete Video', type: 'button' }
  }));

  btn.addEventListener('click', async () => {
    const confirmed = await showConfirmModal(video.title || 'Untitled');
    if (!confirmed) return;

    const buttons = card.querySelectorAll('.action-btn');
    buttons.forEach(b => b.disabled = true);
    btn.innerHTML = `<div class="spinner-overlay"><div class="loading-spinner"></div></div>` + ICONS.trash + ' <span>Deleting</span>';

    try {
      await deleteVideo(video.id);
      showToast('Video deleted', 'success');
      await refreshVideos();
    } catch (error) {
      showToast(error.message || 'Failed to delete video', 'error');
      buttons.forEach(b => b.disabled = false);
      btn.innerHTML = ICONS.trash + ' <span>Delete</span>';
    }
  });

  return btn;
}
