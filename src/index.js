/** Application entry point that initializes the HTTP server and WebSocket */
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const { initializeWebSocket } = require('./services/websocket.service');
const bootstrap = require('./utils/bootstrap');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

initializeWebSocket(io);

bootstrap.init().then(() => {
  server.listen(config.port, () => {
    console.log(`[Server] MEDIS running on port ${config.port}`);
  });
});