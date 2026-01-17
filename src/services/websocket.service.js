const videoService = require('./video.service');

let wssInstance = null;
let activeDownloads = 0;
let downloadQueueSize = 0;

exports.initializeWebSocket = (wss) => {
  wssInstance = wss;
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'status', activeDownloads, queueSize: downloadQueueSize }));
  });
};

exports.broadcast = (data) => {
  if (!wssInstance) return;
  wssInstance.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

exports.updateStatus = (active, queue) => {
    activeDownloads = active;
    downloadQueueSize = queue;
    this.broadcast({ type: 'status', activeDownloads: active, queueSize: queue });
};

exports.cleanupOnStartup = async () => {
    console.log('[Startup] Resetting active download counter');
    activeDownloads = 0;
    try {
        await videoService.cleanupOrphanedFiles();
    } catch (err) {
        console.error('[Startup] An error occurred during cleanup:', err);
    }
};