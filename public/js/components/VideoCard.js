import { el } from '../utils/dom.js';
import { ICONS } from '../utils/icons.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from './Toast.js';
import { showConfirmModal } from './Modal.js';
import { deleteVideo } from '../api/client.js';

const thumbObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const target = entry.target;
      const thumbUrl = target.dataset.thumb;
      if (thumbUrl) {
        target.style.backgroundImage = `url('${thumbUrl}')`;
        delete target.dataset.thumb;
      }
      observer.unobserve(target);
    }
  });
}, { rootMargin: '200px 0px' });

function _playVideo(event) {
  const placeholder = event.currentTarget;
  const videoSrc = placeholder.dataset.src;
  if (!videoSrc) return;

  event.stopPropagation();

  const modal = document.getElementById('video-player-modal');
  const videoPlayer = document.getElementById('video-modal-player');
  const closeBtn = document.getElementById('video-modal-close');

  if (!modal || !videoPlayer) return;

  videoPlayer.src = videoSrc;
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('visible'));

  document.body.style.overflow = 'hidden';

  const closeModal = () => {
    videoPlayer.pause();
    videoPlayer.src = '';
    document.body.style.overflow = '';
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 220);
    closeBtn.removeEventListener('click', closeModal);
    modal.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onEsc);
  };

  const onEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  const onOverlayClick = (e) => {
    if (e.target === modal) closeModal();
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onEsc);
}

function _getResolutionLabel(width, height) {
  if (!width || !height) return '';
  const minSide = Math.min(width, height);
  if (minSide >= 2160) return '4K';
  if (minSide >= 1440) return '2K';
  if (minSide >= 1080) return '1080p';
  if (minSide >= 720) return '720p';
  return 'SD';
}

export function createVideoCard(video) {
  const card = el('div', {
    className: 'video-card group',
    attrs: { id: `video-card-${video.id}` },
    dataset: { videoId: video.id }
  });

  const thumbWrapper = el('div', { className: 'card-thumb-wrapper' });

  const placeholder = el('div', {
    className: 'card-video-placeholder',
    dataset: { src: `/api/stream/${video.filename}` }
  });

  if (video.thumbnailUrl && video.thumbnailUrl.trim() !== '') {
    placeholder.dataset.thumb = video.thumbnailUrl;
    thumbObserver.observe(placeholder);
  } else {
    placeholder.classList.add('no-thumbnail');
  }

  const playIcon = el('div', {
    className: 'play-icon-wrapper',
    html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
  });
  placeholder.appendChild(playIcon);
  placeholder.addEventListener('click', _playVideo);

  const badgesContainer = el('div', { className: 'card-badges-overlay' });
  const resLabel = _getResolutionLabel(video.width, video.height);
  if (resLabel) {
    const resBadge = el('span', { className: 'badge-pill badge-res', text: resLabel });
    badgesContainer.appendChild(resBadge);
  }

  thumbWrapper.append(placeholder, badgesContainer);

  const info = el('div', { className: 'card-info-modern' });

  const title = el('h3', { className: 'card-title-modern', text: video.title || 'Untitled Video' });

  const metaRow = el('div', { className: 'card-meta-row' });
  const date = el('span', { className: 'card-meta-item' });
  const dt = video.createdAt ? new Date(video.createdAt) : null;
  date.textContent = dt && !isNaN(dt.getTime())
    ? dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  metaRow.append(date);

  const actionsRow = el('div', { className: 'card-actions-row' });
  const copyBtn = _createCopyButton(video);
  const deleteBtn = _createDeleteButton(video, card);
  actionsRow.append(copyBtn, deleteBtn);

  info.append(title, metaRow, actionsRow);

  card.append(thumbWrapper, info);

  return card;
}

function _createCopyButton(video) {
  const btn = el('button', {
    className: 'btn-action-clean btn-copy-clean',
    html: ICONS.copy + ' <span>Share</span>',
    attrs: { title: 'Copy Share Link', type: 'button' }
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    const shareLink = `${window.location.origin}/share/${video.id}`;
    try {
      const copied = await copyToClipboard(shareLink);
      if (!copied) throw new Error('copy failed');
      btn.disabled = true;
      btn.classList.add('copied');
      btn.innerHTML = ICONS.copied + ' <span>Copied!</span>';
      showToast('Share link copied to clipboard', 'success');
      setTimeout(() => {
        btn.innerHTML = ICONS.copy + ' <span>Share</span>';
        btn.classList.remove('copied');
        btn.disabled = false;
      }, 2000);
    } catch (_e) {
      showToast('Failed to copy link', 'error');
    }
  });

  return btn;
}

function _createDeleteButton(video, card) {
  const btn = el('button', {
    className: 'btn-action-clean btn-delete-clean',
    html: ICONS.trash + ' <span>Delete</span>',
    attrs: { title: 'Delete Video', type: 'button' }
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await showConfirmModal(video.title || 'Untitled');
    if (!confirmed) return;

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner-inline"></div>`;

    try {
      await deleteVideo(video.id);
      showToast('Video deleted successfully', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to delete video', 'error');
      btn.disabled = false;
      btn.innerHTML = ICONS.trash + ' <span>Delete</span>';
    }
  });

  return btn;
}