/** Service for broadcasting real-time updates to connected clients */
const videoService = require('./video.service');

let ioInstance = null;
let activeDownloads = 0;
let downloadQueueSize = 0;

exports.initializeWebSocket = (io) => {
  ioInstance = io;
  io.on('connection', (socket) => {
    socket.emit('message', JSON.stringify({ type: 'status', activeDownloads, queueSize: downloadQueueSize }));
  });
};

exports.broadcast = (data) => {
  if (!ioInstance) return;
  ioInstance.emit('message', JSON.stringify(data));
};

exports.updateStatus = (active, queue) => {
    activeDownloads = active;
    downloadQueueSize = queue;
    exports.broadcast({ type: 'status', activeDownloads: active, queueSize: queue });
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