const path = require('path');
require('dotenv').config({ quiet: true });

const config = {
  port: process.env.PORT || 3000,
  maxQueueLimit: parseInt(process.env.MAX_QUEUE_LIMIT, 10) || 10,
  storagePath: path.resolve(__dirname, '../../storage'),
  videosPath: path.resolve(__dirname, '../../storage/videos'),
  cookiesPath: path.resolve(__dirname, '../../storage/cookies'),
  dbPath: path.resolve(__dirname, '../../storage/videos/medis.db'),
  autoUpdateYtdlp: process.env.AUTO_UPDATE_YTDLP === 'true',
  playlistDownloadLimit: parseInt(process.env.PLAYLIST_DOWNLOAD_LIMIT, 10) || 1,
};

module.exports = config;