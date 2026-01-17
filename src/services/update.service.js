const { exec } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;

const ytdlp = new YTDlpWrap();

const checkForUpdates = async () => {
  console.log('[Updater] Running scheduled check for yt-dlp');
  try {
    const currentVersion = (await ytdlp.getVersion()).trim();
    await new Promise((resolve, reject) => {
      const child = exec('yt-dlp --update', (error, stdout, stderr) => {
        if (error) {
          console.error(`[Updater] ERROR: Update check failed. Stderr: ${stderr.trim()}`);
          return reject(error);
        }

        if (stdout.includes('yt-dlp is up to date')) {
          console.log(`[Updater] INFO: yt-dlp is already up to date (v${currentVersion})`);
        } else {
          console.log(`[Updater] SUCCESS: yt-dlp updated successfully. Output: ${stdout.trim()}`);
        }
        resolve();
      });
    });
  } catch (error) {
    console.error(`[Updater] FATAL: An exception occurred during the update process`, error);
  }
};

exports.scheduleYtdlpUpdate = () => {
  setTimeout(checkForUpdates, 60 * 1000); 
  setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
};