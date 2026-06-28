/** WebSocket service for real-time bi-directional communication with the backend */
import { setState } from '../state/store.js';
import { showToast } from '../components/Toast.js';

let _socket = null;

/** Reconnection config */
const RECONNECT = {
  baseMs: 1200,
  maxMs: 30000,
  attempt: 0
};

/** Calculate delay with exponential backoff */
function _getReconnectDelay() {
  const delay = Math.min(
    RECONNECT.baseMs * Math.pow(2, RECONNECT.attempt),
    RECONNECT.maxMs
  );
  RECONNECT.attempt++;
  return delay;
}

/** Establish a WebSocket connection and set up message routing */
export function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  _socket = new WebSocket(`${protocol}://${window.location.host}`);

  _socket.onopen = () => {
    RECONNECT.attempt = 0;

    if (getState('downloadingCount') > 0) {
      setState('progress:show', {});
    }
  };

  _socket.onclose = () => {
    const delay = _getReconnectDelay();
    setTimeout(connect, delay);
  };

  _socket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
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
          progressMessage: data.message
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
  };
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

  setState('progress:idle', {});
}
