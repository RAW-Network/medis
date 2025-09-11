const { exec } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;

const ytdlp = new YTDlpWrap();

const checkForUpdates = async () => {
  console.log('[Updater] Checking for yt-dlp updates...');
  try {
    const currentVersion = await ytdlp.getVersion();
    await new Promise((resolve, reject) => {
      const child = exec('yt-dlp --update', (error, stdout, stderr) => {
        if (error) {
          console.error(`[Updater] Failed to update yt-dlp. Stderr: ${stderr}`);
          return reject(error);
        }
        if (stdout.includes('yt-dlp is up to date')) {
          console.log(`[Updater] yt-dlp is already at the latest version (${currentVersion}).`);
        } else {
          console.log(`[Updater] yt-dlp has been updated successfully. Details: ${stdout}`);
        }
        resolve();
      });
    });
  } catch (error) {
    console.error(`[Updater] An error occurred during the yt-dlp update check:`, error);
  }
};

exports.scheduleYtdlpUpdate = () => {
  console.log('[Updater] Service initialized. yt-dlp auto-update is enabled.');
  setTimeout(checkForUpdates, 60 * 1000); 
  setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
};