/** WebSocket service for real-time bi-directional communication with the backend */
import { getState, setState } from '../state/store.js';
import { showToast } from '../components/Toast.js';

let _socket = null;

/** Establish a WebSocket connection and set up message routing via Socket.IO */
export function connect() {
  // Initialize Socket.IO client
  _socket = io();

  _socket.on('connect', () => {
    if (getState('downloadingCount') > 0) {
      setState('progress:show', {});
    }
  });

  _socket.on('message', (messageStr) => {
    let data;
    try {
      data = JSON.parse(messageStr);
    } catch (_e) {
      return;
    }

    switch (data.type) {
      case 'status':
        _handleStatus(data);
        break;
      case 'progress':
        setState('progress:updated', {
          progressPercent: data.percent,
          progressMessage: data.message,
          speed: data.speed,
          eta: data.eta
        });
        break;
      case 'downloadComplete':
        _handleDownloadComplete(data);
        break;
      case 'downloadError':
        showToast(data.message || 'Download error', 'error');
        setState('progress:idle', {});
        break;
      case 'VIDEO_DELETED':
        setState('video:deleted', { deletedVideoId: data.payload.id });
        break;
      default:
        break;
    }
  });
}

/** Handle a 'status' WebSocket message */
function _handleStatus(data) {
  const queued = data.queueSize || 0;
  const active = data.activeDownloads || 0;
  setState('status:updated', { downloadingCount: active + queued });

  if (active === 0 && queued === 0) {
    setState('progress:idle', {});
  }
}

/** Handle a 'downloadComplete' WebSocket message — prepend video directly */
function _handleDownloadComplete(data) {
  const title = (data.video && data.video.title) ? data.video.title : 'Completed';
  showToast(`Downloaded: ${title}`, 'success');

  if (data.video && data.video.id) {
    setState('video:prepend', { newVideo: data.video });
  }

  // Immediately dismiss progress bar on completion
  setState('progress:hide', {});
}
