const path = require('path');
require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  maxQueueLimit: parseInt(process.env.MAX_QUEUE_LIMIT, 10) || 5,
  storagePath: path.resolve(__dirname, '../../storage'),
  videosPath: path.resolve(__dirname, '../../storage/videos'),
  cookiesPath: path.resolve(__dirname, '../../storage/cookies'),
  dbPath: path.resolve(__dirname, '../../storage/videos/medis.db'),
};

module.exports = config;