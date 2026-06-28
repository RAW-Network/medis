/** Video library component for fetching and rendering the list of videos */
import { $ } from '../utils/dom.js';
import { fetchVideos } from '../api/client.js';
import { setState, getState, subscribe } from '../state/store.js';
import { createVideoCard } from './VideoCard.js';

/** @type {HTMLElement} */ let _grid;

/** HTML for the empty library state */
const EMPTY_HTML = '<p class="library-empty">Your library is empty. Start by downloading a video.</p>';

/** HTML for the error state */
const ERROR_HTML = '<p class="library-error">Failed to load video library.</p>';

/** Render the video list into the grid container */
function _renderVideos(videos) {
  _grid.innerHTML = '';

  if (!videos || videos.length === 0) {
    _grid.innerHTML = EMPTY_HTML;
    return;
  }

  const fragment = document.createDocumentFragment();
  videos.forEach((video) => {
    fragment.appendChild(createVideoCard(video));
  });
  _grid.appendChild(fragment);
}

/** Prepend a single new video card to the grid (no re-fetch needed) */
function _prependVideo(state) {
  const video = state.newVideo;
  if (!video || !video.id) return;

  // Don't add duplicate
  if (document.getElementById(`video-card-${video.id}`)) return;

  // Remove empty state message if present
  const emptyMsg = _grid.querySelector('.library-empty');
  if (emptyMsg) emptyMsg.remove();

  const card = createVideoCard(video);
  _grid.insertBefore(card, _grid.firstChild);

  const newCount = _grid.querySelectorAll('.video-card').length;
  setState('videos:updated', { completedCount: newCount });
}

/** Handle a VIDEO_DELETED event by removing the card */
function _handleVideoDeleted(state) {
  const videoId = state.deletedVideoId;
  if (!videoId) return;

  const card = document.getElementById(`video-card-${videoId}`);
  if (card) {
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    setTimeout(() => {
      card.remove();
      const currentCount = getState('completedCount');
      const newCount = Math.max(0, currentCount - 1);
      setState('videos:updated', { completedCount: newCount });

      if (_grid.querySelectorAll('.video-card').length === 0) {
        _grid.innerHTML = EMPTY_HTML;
      }
    }, 250);
  }
}

/** Fetch videos from the API and update the store + DOM */
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

/** Initialise library DOM references and initial fetch */
export function initVideoLibrary() {
  _grid = $('video-list');

  // When a new video is downloaded, prepend it directly (no re-fetch)
  subscribe('video:prepend', _prependVideo);

  // When a video is deleted via WebSocket broadcast
  subscribe('video:deleted', _handleVideoDeleted);

  // Initial load — only time we fetch the full list
  refreshVideos();
}
