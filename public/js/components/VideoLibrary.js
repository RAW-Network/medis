// components/VideoLibrary.js - Manages the video grid and fetching

import { $ } from '../utils/dom.js';
import { fetchVideos } from '../api/client.js';
import { setState, getState, subscribe } from '../state/store.js';
import { createVideoCard } from './VideoCard.js';

/** @type {HTMLElement} */ let _grid;

/** HTML for the empty library state */
const EMPTY_HTML = '<p style="text-align:center; color: rgba(255,255,255,.68); grid-column: 1 / -1;">Your library is empty. Start by downloading a video.</p>';

/** HTML for the error state */
const ERROR_HTML = '<p style="text-align:center; grid-column: 1 / -1; color: rgba(251,113,133,.95);">Failed to load video library.</p>';

/** Render the video list into the grid container */
function _renderVideos(videos) {
  _grid.innerHTML = '';

  if (!videos || videos.length === 0) {
    _grid.innerHTML = EMPTY_HTML;
    return;
  }

  videos.forEach((video) => {
    _grid.appendChild(createVideoCard(video));
  });
}

/** Handle a VIDEO_DELETED event by animating out the card */
function _handleVideoDeleted(state) {
  const videoId = state.deletedVideoId;
  if (!videoId) return;

  const card = document.getElementById(`video-card-${videoId}`);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';

    setTimeout(() => {
      card.remove();
      const currentCount = getState('completedCount');
      const newCount = Math.max(0, currentCount - 1);
      setState('videos:updated', { completedCount: newCount });

      if (_grid.children.length === 0) {
        _grid.innerHTML = EMPTY_HTML;
      }
    }, 300);
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

/** Initialise the VideoLibrary component */
export function initVideoLibrary() {
  _grid = $('video-list');

  // When WebSocket signals a completed download, refresh the library
  subscribe('videos:refresh', () => {
    refreshVideos();
  });

  // When a video is deleted via WebSocket broadcast (from another tab)
  subscribe('video:deleted', _handleVideoDeleted);

  // Initial load
  refreshVideos();
}
