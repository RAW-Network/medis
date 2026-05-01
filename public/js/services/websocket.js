// services/websocket.js - WebSocket client with auto-reconnect

import { getState, setState } from '../state/store.js';
import { showToast } from '../components/Toast.js';

let _socket = null;

const RECONNECT_DELAY = 1200;

/** Establish a WebSocket connection and set up message routing */
export function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  _socket = new WebSocket(`${protocol}://${window.location.host}`);

  _socket.onclose = () => setTimeout(connect, RECONNECT_DELAY);

  _socket.onopen = () => {
    if (getState('downloadingCount') > 0) {
      setState('progress:show', {});
    }
  };

  _socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

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

/** Handle a 'downloadComplete' WebSocket message */
function _handleDownloadComplete(data) {
  const title = (data.video && data.video.title) ? data.video.title : 'Completed';
  showToast(`Downloaded: ${title}`, 'success');
  setState('videos:refresh', {});
  setState('progress:idle', {});
}
