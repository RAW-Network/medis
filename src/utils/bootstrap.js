const fs = require('fs');
const config = require('../config');
const { cleanupOnStartup } = require('../services/websocket.service');
const { scheduleYtdlpUpdate } = require('../services/update.service');

exports.ensureDirectoriesExist = () => {
  const dirs = [config.storagePath, config.cookiesPath, config.videosPath, config.thumbnailsPath];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

exports.init = async () => {
  try {
    exports.ensureDirectoriesExist();
    await cleanupOnStartup();

    if (config.autoUpdateYtdlp) {
      scheduleYtdlpUpdate();
    }

    console.log(`[Config] Max queue limit: ${config.maxQueueLimit !== null ? config.maxQueueLimit : 'No Limit'}`);
    console.log(`[Config] Max playlist limit: ${config.playlistDownloadLimit !== null ? config.playlistDownloadLimit : 'No Limit'}`);
    console.log(`[Config] Auto-update yt-dlp: ${config.autoUpdateYtdlp ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('[Startup] Critical error during startup', error);
    process.exit(1);
  }
};