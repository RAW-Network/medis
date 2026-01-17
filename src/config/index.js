const path = require('path');
require('dotenv').config({ quiet: true });

const baseDataPath = path.resolve(__dirname, '../../data');
const baseCookiesPath = path.resolve(__dirname, '../../cookies');

function parsePositiveIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  maxQueueLimit: parsePositiveIntOrNull(process.env.MAX_QUEUE_LIMIT),
  playlistDownloadLimit: parsePositiveIntOrNull(process.env.PLAYLIST_DOWNLOAD_LIMIT),
  autoUpdateYtdlp: process.env.AUTO_UPDATE_YTDLP === 'true',
  storagePath: baseDataPath,
  dbPath: path.join(baseDataPath, 'medis.db'),
  videosPath: path.join(baseDataPath, 'videos'),
  thumbnailsPath: path.join(baseDataPath, 'thumbnail'),
  cookiesPath: baseCookiesPath
};

module.exports = config;
