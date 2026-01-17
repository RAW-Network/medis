const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');

const ytdlp = new YTDlpWrap();

exports.getPlaylistItems = async (url, limit) => {
  const args = [url, '--flat-playlist', '--dump-json'];
  if (limit) args.push('--playlist-end', String(limit));

  const stdout = await ytdlp.execPromise(args);
  return stdout.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
};

exports.getMetadata = async (url, cookiesPath) => {
  const args = ['--dump-json', '--', url];
  
  if (cookiesPath && fs.existsSync(cookiesPath)) {
    args.unshift('--cookies', cookiesPath);
  }
  
  const stdout = await ytdlp.execPromise(args);
  return JSON.parse(stdout);
};

exports.executeDownload = (url, outputPath, cookiesPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '-f', 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[vcodec^=avc1]/best[ext=mp4]/best',
      '-o', outputPath,
      '--progress', '--no-part', '--merge-output-format', 'mp4'
    ];

    if (cookiesPath && fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    const downloader = ytdlp.exec(args);

    if (onProgress) {
      downloader.on('progress', (p) => {
        const percent = parseFloat(p.percent);
        if (!isNaN(percent)) onProgress(percent);
      });
    }

    downloader.on('close', resolve);
    downloader.on('error', reject);
  });
};