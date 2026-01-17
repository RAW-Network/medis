const http = require('http');
const { WebSocketServer } = require('ws');
const app = require('./app');
const config = require('./config');
const { initializeWebSocket } = require('./services/websocket.service');
const bootstrap = require('./utils/bootstrap');

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

initializeWebSocket(wss);

bootstrap.init().then(() => {
  server.listen(config.port, () => {
    console.log(`[Server] MEDIS running on port ${config.port}`);
  });
});