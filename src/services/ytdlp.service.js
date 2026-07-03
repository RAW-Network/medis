/** Service wrapper for yt-dlp operations like fetching playlists */
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const config = require('../config');

const ytdlp = new YTDlpWrap(config.ytdlpPath);

// Common args for all yt-dlp calls
const COMMON_ARGS = ['--js-runtimes', 'node'];

exports.getPlaylistItems = async (url, limit, cookiesPath) => {
  const args = [...COMMON_ARGS, url, '--flat-playlist', '--dump-json'];
  if (limit) args.push('--playlist-end', String(limit));
  if (cookiesPath && fs.existsSync(cookiesPath)) {
    try {
      fs.chmodSync(cookiesPath, 0o600);
    } catch (err) {
      console.warn('[yt-dlp] Could not set 600 permission on cookies.txt:', err.message);
    }
    args.push('--cookies', cookiesPath);
  }

  const stdout = await ytdlp.execPromise(args);
  return stdout.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
};

exports.getMetadata = async (url, cookiesPath) => {
  const args = [...COMMON_ARGS, '--dump-json', '--', url];
  
  if (cookiesPath && fs.existsSync(cookiesPath)) {
    try {
      fs.chmodSync(cookiesPath, 0o600);
    } catch (err) {
      console.warn('[yt-dlp] Could not set 600 permission on cookies.txt:', err.message);
    }
    args.unshift('--cookies', cookiesPath);
  }
  
  const stdout = await ytdlp.execPromise(args);
  return JSON.parse(stdout);
};

exports.executeDownload = (url, outputPath, cookiesPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const args = [
      ...COMMON_ARGS,
      url,
      '-f', 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[vcodec^=avc1]/best[ext=mp4]/best',
      '-o', outputPath,
      '--write-info-json', // Export metadata alongside the video file
      '--newline', // Enforce newline output for predictable stream parsing
      '--progress', '--no-part', '--merge-output-format', 'mp4'
    ];

    if (cookiesPath && fs.existsSync(cookiesPath)) {
      try {
        // Ensure cookie file has restricted permissions before reading
        fs.chmodSync(cookiesPath, 0o600);
      } catch (err) {
        console.warn('[yt-dlp] Could not set 600 permission on cookies.txt:', err.message);
      }
      args.push('--cookies', cookiesPath);
    }

    const downloader = ytdlp.exec(args);

    if (onProgress) {
      downloader.on('ytDlpEvent', (eventType, eventData) => {
        if (eventType === 'download' && eventData.includes('%')) {
          // Parse raw terminal output to extract accurate download metrics
          const percentMatch = eventData.match(/(\d+\.?\d*)%/);
          const speedMatch = eventData.match(/at\s+([\d.]+)(KiB|MiB|GiB)\/s/);
          const etaMatch = eventData.match(/ETA\s+(\d+):(\d+)/);

          if (percentMatch) {
            const percent = parseFloat(percentMatch[1]);
            
            let speedBytes = 0;
            if (speedMatch) {
              const val = parseFloat(speedMatch[1]);
              const unit = speedMatch[2];
              if (unit === 'KiB') speedBytes = val * 1024;
              else if (unit === 'MiB') speedBytes = val * 1048576;
              else if (unit === 'GiB') speedBytes = val * 1073741824;
            }

            let etaSecs = 0;
            if (etaMatch) {
              etaSecs = parseInt(etaMatch[1]) * 60 + parseInt(etaMatch[2]);
            }

            // Only broadcast non-NaN percentages to prevent UI glitches
            if (!isNaN(percent)) onProgress(percent, speedBytes, etaSecs);
          }
        }
      });
    }

    downloader.on('close', resolve);
    downloader.on('error', reject);
  });
};