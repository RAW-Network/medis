import { $ } from '../utils/dom.js';
import { fetchVideos } from '../api/client.js';
import { setState, getState, subscribe } from '../state/store.js';
import { createVideoCard } from './VideoCard.js';

let _grid;
let _allVideos = [];
let _displayedCount = 0;
const PAGE_SIZE = 24;
let _scrollObserver = null;
let _sentinel = null;

const EMPTY_HTML = '<p class="library-empty">Your library is empty. Start by downloading a video.</p>';
const ERROR_HTML = '<p class="library-error">Failed to load video library.</p>';

function _appendNextBatch() {
  if (_displayedCount >= _allVideos.length) return;

  const nextBatch = _allVideos.slice(_displayedCount, _displayedCount + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  nextBatch.forEach((video) => {
    fragment.appendChild(createVideoCard(video));
  });

  if (_sentinel && _sentinel.parentNode === _grid) {
    _grid.insertBefore(fragment, _sentinel);
  } else {
    _grid.appendChild(fragment);
  }

  _displayedCount += nextBatch.length;

  if (_displayedCount >= _allVideos.length && _sentinel) {
    _sentinel.style.display = 'none';
  } else if (_sentinel) {
    _sentinel.style.display = 'block';
  }
}

function _setupSentinel() {
  if (!_sentinel) {
    _sentinel = document.createElement('div');
    _sentinel.id = 'library-scroll-sentinel';
    _sentinel.style.height = '20px';
    _sentinel.style.gridColumn = '1 / -1';
  }

  _grid.appendChild(_sentinel);

  if (_scrollObserver) {
    _scrollObserver.disconnect();
  }

  _scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      _appendNextBatch();
    }
  }, { rootMargin: '300px' });

  _scrollObserver.observe(_sentinel);
}

function _renderVideos(videos) {
  _allVideos = videos || [];
  _displayedCount = 0;
  _grid.innerHTML = '';

  if (_allVideos.length === 0) {
    _grid.innerHTML = EMPTY_HTML;
    return;
  }

  _setupSentinel();
  _appendNextBatch();
}

function _prependVideo(state) {
  const video = state.newVideo;
  if (!video || !video.id) return;

  if (document.getElementById(`video-card-${video.id}`)) return;

  const emptyMsg = _grid.querySelector('.library-empty');
  if (emptyMsg) emptyMsg.remove();

  _allVideos.unshift(video);
  _displayedCount++;

  const card = createVideoCard(video);
  _grid.insertBefore(card, _grid.firstChild);

  setState('videos:updated', { completedCount: _allVideos.length });
}

function _handleVideoDeleted(state) {
  const videoId = state.deletedVideoId;
  if (!videoId) return;

  _allVideos = _allVideos.filter((v) => v.id !== videoId);

  const card = document.getElementById(`video-card-${videoId}`);
  if (card) {
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    setTimeout(() => {
      card.remove();
      _displayedCount = Math.max(0, _displayedCount - 1);
      const newCount = _allVideos.length;
      setState('videos:updated', { completedCount: newCount });

      if (_allVideos.length === 0) {
        _grid.innerHTML = EMPTY_HTML;
      }
    }, 250);
  }
}

export async function refreshVideos() {
  try {
    const videos = await fetchVideos();
    setState('videos:updated', {
      videos,
      completedCount: videos.length
    });
    _renderVideos(videos);
  } catch (_error) {
    _grid.innerHTML = ERROR_HTML;
  }
}

export function initVideoLibrary() {
  _grid = $('video-list');

  subscribe('video:prepend', _prependVideo);
  subscribe('video:deleted', _handleVideoDeleted);

  refreshVideos();
}