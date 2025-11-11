const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const app = require('./app');
const config = require('./config');
const { initializeWebSocket, cleanupOnStartup } = require('./services/websocket.service');
const { scheduleYtdlpUpdate } = require('./services/update.service');

function ensureDirectoriesExist() {
  if (!fs.existsSync(config.storagePath)) fs.mkdirSync(config.storagePath, { recursive: true });
  if (!fs.existsSync(config.cookiesPath)) fs.mkdirSync(config.cookiesPath, { recursive: true });
  if (!fs.existsSync(config.videosPath)) fs.mkdirSync(config.videosPath, { recursive: true });
  if (!fs.existsSync(config.thumbnailsPath)) fs.mkdirSync(config.thumbnailsPath, { recursive: true });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

initializeWebSocket(wss);

(async () => {
  try {
    ensureDirectoriesExist();
    await cleanupOnStartup();

    if (config.autoUpdateYtdlp) {
      scheduleYtdlpUpdate();
    }

    server.listen(config.port, () => {
      console.log(`[Server] MEDIS running on port ${config.port}`);
      console.log(`[Config] Max queue limit: ${config.maxQueueLimit !== null ? config.maxQueueLimit : 'No Limit'}`);
      console.log(`[Config] Max playlist limit: ${config.playlistDownloadLimit !== null ? config.playlistDownloadLimit : 'No Limit'}`);
      console.log(`[Config] Auto-update yt-dlp: ${config.autoUpdateYtdlp ? 'enabled' : 'disabled'}`);
    });
  } catch (error) {
    console.error('[Startup] Critical error during startup', error);
    process.exit(1);
  }
})();
