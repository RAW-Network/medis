// api/client.js - Centralized HTTP client for all backend API interactions

const API_URL = '/api';

/** Fetch the list of all downloaded videos */
export async function fetchVideos() {
  const response = await fetch(`${API_URL}/videos`);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const videos = await response.json();
  return Array.isArray(videos) ? videos : [];
}

/** Submit a URL for download */
export async function requestDownload(url) {
  const response = await fetch(`${API_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'An unknown error occurred during the request');
  }
  return result;
}

/** Delete a video by its ID */
export async function deleteVideo(id) {
  const response = await fetch(`${API_URL}/videos/${id}`, { method: 'DELETE' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'Failed to delete video');
  }
  return result;
}

/** Fetch yt-dlp and MEDIS version info */
export async function fetchVersion() {
  const response = await fetch(`${API_URL}/version`);
  if (!response.ok) throw new Error('Failed to fetch version info');
  return response.json();
}
