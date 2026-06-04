// api/client.js - Centralized HTTP client for all backend API interactions

const API_URL = '/api';

/** In-flight request tracker for deduplication */
let _videosRequest = null;

/** Fetch the list of all downloaded videos (deduplicated) */
export async function fetchVideos() {
  if (_videosRequest) return _videosRequest;

  _videosRequest = _fetchVideosInternal();
  try {
    return await _videosRequest;
  } finally {
    _videosRequest = null;
  }
}

async function _fetchVideosInternal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}/videos`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const videos = await response.json();
    return Array.isArray(videos) ? videos : [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Submit a URL for download */
export async function requestDownload(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'An unknown error occurred during the request');
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/** Delete a video by its ID */
export async function deleteVideo(id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}/videos/${id}`, {
      method: 'DELETE',
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Failed to delete video');
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch yt-dlp and MEDIS version info */
export async function fetchVersion() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/version`, { signal: controller.signal });
    if (!response.ok) throw new Error('Failed to fetch version info');
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
