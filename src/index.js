const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const app = require('./app');
const config = require('./config');
const { initializeWebSocket, cleanupOnStartup } = require('./services/websocket.service');

function ensureDirectoriesExist() {
  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }
  if (!fs.existsSync(config.cookiesPath)) {
    fs.mkdirSync(config.cookiesPath, { recursive: true });
  }
  if (!fs.existsSync(config.videosPath)) {
    fs.mkdirSync(config.videosPath, { recursive: true });
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

initializeWebSocket(wss);

(async () => {
  try {
    ensureDirectoriesExist();
    await cleanupOnStartup();
    server.listen(config.port, () => {
      console.log(`MEDIS app running at http://localhost:${config.port}`);
      console.log(`[Config] Maximum queue limit set to: ${config.maxQueueLimit}`);
    });
  } catch (error) {
    console.error('[Startup] Failed to start the server:', error);
    process.exit(1);
  }
})();