const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const YTDlpWrap = require('yt-dlp-wrap').default;
const axios = require('axios');
const config = require('../config');
const videoService = require('./video.service');
const websocketService = require('./websocket.service');
const CustomError = require('../utils/CustomError');
const { isPlaylistUrl } = require('../utils/security');

const ytdlp = new YTDlpWrap();
const downloadQueue = [];
let activeDownloads = 0;

exports.processUrl = async (url) => {
  if (isPlaylistUrl(url)) {
    console.log(`[Queue] Playlist detected. Fetching up to ${config.playlistDownloadLimit} video entries`);
    
    const playlistItemsArgs = [
      url,
      '--flat-playlist',
      '--dump-json',
      '--playlist-end', config.playlistDownloadLimit
    ];

    try {
      const stdout = await ytdlp.execPromise(playlistItemsArgs);
      const videoInfos = stdout.trim().split('\n').map(line => JSON.parse(line));

      if (videoInfos.length === 0) {
        throw new CustomError('Could not find any videos in the provided playlist', 404);
      }

      if (activeDownloads + downloadQueue.length + videoInfos.length > config.maxQueueLimit) {
        throw new CustomError(`Adding ${videoInfos.length} videos would exceed the queue limit (max: ${config.maxQueueLimit})`, 429);
      }

      videoInfos.forEach(video => {
        if (video.url) {
          exports.addToQueue(video.url);
        }
      });

      return { status: 202, message: `Playlist processed. Added ${videoInfos.length} videos to the queue` };

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      console.error('[Playlist] Failed to process playlist URL', error);
      if (error.message.includes('Sign in') || error.message.includes('private')) {
        throw new CustomError('This playlist is private or requires login', 403);
      }
      throw new CustomError('Failed to fetch playlist details. The playlist may be empty or invalid', 500);
    }
  } else {
    return exports.addToQueue(url);
  }
};

exports.addToQueue = (url) => {
  if (activeDownloads + downloadQueue.length >= config.maxQueueLimit) {
    console.warn(`[Queue] Total job limit reached. Rejecting new download request. Limit: ${config.maxQueueLimit}`);
    throw new CustomError(`Queue limit reached (max: ${config.maxQueueLimit}). Please try again later`, 429);
  }

  const jobId = uuidv4();
  if (activeDownloads > 0) {
    downloadQueue.push({ url, jobId });
    websocketService.updateStatus(activeDownloads, downloadQueue.length);
    console.log(`[Queue] Download added to queue. Current queue size: ${downloadQueue.length}`);
    return { status: 202, message: 'Download has been added to the queue' };
  } else {
    startDownload({ url, jobId });
    return { status: 202, message: 'Download initiated' };
  }
};

async function processNextInQueue() {
  if (activeDownloads > 0 || downloadQueue.length === 0) {
    return;
  }
  const nextDownload = downloadQueue.shift();
  console.log(`[Queue] Starting next download from queue. Queue size: ${downloadQueue.length}`);
  await startDownload(nextDownload);
}

async function startDownload({ url, jobId }) {
  activeDownloads++;
  websocketService.updateStatus(activeDownloads, downloadQueue.length);

  const videoId = jobId;
  const cookiesFilePath = path.join(config.cookiesPath, 'cookies.txt');
  const commonArgs = [];
  if (fs.existsSync(cookiesFilePath)) {
    try {
        await fs.promises.access(cookiesFilePath);
        commonArgs.push('--cookies', cookiesFilePath);
    } catch {}
  }

  try {
    websocketService.broadcast({ type: 'progress', stage: 'FETCHING_METADATA', message: 'Fetching Video Info', percent: 0, videoId });
    const infoArgs = [...commonArgs, '--dump-json', '--', url];
    const stdout = await ytdlp.execPromise(infoArgs);
    const metadata = JSON.parse(stdout);

    websocketService.broadcast({ type: 'progress', stage: 'FETCHING_THUMBNAIL', message: 'Fetching Thumbnail', videoId });
    let finalThumbnailUrl = '';
    if (metadata.thumbnail) {
        finalThumbnailUrl = await downloadThumbnail(metadata.thumbnail, videoId);
    }

    const newVideoData = {
        id: videoId,
        title: metadata.title || 'Untitled Video',
        originalUrl: url,
        filename: `${videoId}.mp4`,
        thumbnailUrl: finalThumbnailUrl,
        createdAt: new Date().toISOString(),
        width: metadata.width || 1280,
        height: metadata.height || 720
    };

    await executeDownload(url, newVideoData, commonArgs);

  } catch (error) {
    handleDownloadError(error, videoId);
  } finally {
    finishDownload();
  }
}

async function downloadThumbnail(thumbnailUrl, videoId) {
    try {
        const thumbnailFilename = `${videoId}-thumb.jpg`;
        const thumbnailPath = path.join(config.videosPath, thumbnailFilename);
        const response = await axios.get(thumbnailUrl, {
            responseType: 'stream',
            maxContentLength: 5 * 1024 * 1024,
            maxBodyLength: 5 * 1024 * 1024
        });
        const writer = fs.createWriteStream(thumbnailPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        return `/videos/${thumbnailFilename}`;
    } catch (err) {
        console.error('[AXIOS-ERROR] Failed to download thumbnail', err.message);
        return '';
    }
}

function executeDownload(url, videoData, commonArgs) {
    return new Promise((resolve, reject) => {
        const { id: videoId, filename } = videoData;
        const downloadArgs = [
            url,
            '-f', 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[vcodec^=avc1]/best[ext=mp4]/best',
            '-o', path.join(config.videosPath, filename),
            '--progress',
            '--no-part',
            '--merge-output-format', 'mp4',
            ...commonArgs
        ];

        const downloader = ytdlp.exec(downloadArgs);
        downloader.on('progress', (progress) => {
            const percent = parseFloat(progress.percent);
            if (!isNaN(percent)) {
                websocketService.broadcast({ type: 'progress', stage: 'DOWNLOADING', message: `Downloading Video ${Math.floor(percent)}%`, percent, videoId });
            }
        });
        downloader.on('close', () => {
            websocketService.broadcast({ type: 'progress', stage: 'PROCESSING', message: 'Processing Video', percent: 100, videoId });
            videoService.createVideo(videoData);
            websocketService.broadcast({ type: 'downloadComplete', video: videoData });
            resolve();
        });
        downloader.on('error', reject);
    });
}

function finishDownload() {
  activeDownloads = Math.max(0, activeDownloads - 1);
  websocketService.updateStatus(activeDownloads, downloadQueue.length);
  processNextInQueue();
}

function handleDownloadError(error, videoId) {
    let userMessage = 'An unknown download error occurred. Please check the server logs for more details';
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('unsupported url')) userMessage = 'The provided URL is not supported';
    else if (errorMessage.includes('video unavailable')) userMessage = 'This video is unavailable or has been removed';
    else if (errorMessage.includes('permission denied')) userMessage = 'Cookie file permission denied. Please restart MEDIS';
    else if (errorMessage.includes('sign in') || errorMessage.includes('403: forbidden')) userMessage = 'Download failed: This video may be private or regionally restricted. Using a cookies file might help';
    else if (errorMessage.includes('the downloaded file is empty')) userMessage = 'Download failed: The file is empty, possibly due to regional restrictions or protection';
    else if (errorMessage.includes('404')) userMessage = 'Could not find the video. Please check the URL';
    else if (errorMessage.includes('metadata extraction failed')) userMessage = 'Failed to get video info. The URL might be incorrect or private';

    console.error(`[Backend Error] For video ${videoId}`, error.message);
    websocketService.broadcast({ type: 'downloadError', message: userMessage, videoId });
    cleanupIncompleteFiles(videoId).catch(cleanupErr => {
        console.error(`[Cleanup] Nested error during cleanup for ${videoId}`, cleanupErr);
    });
}

async function cleanupIncompleteFiles(baseFilename) {
  try {
    const files = await fs.promises.readdir(config.videosPath);
    for (const file of files) {
      if (file.startsWith(baseFilename)) {
        await fs.promises.unlink(path.join(config.videosPath, file));
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Error during file cleanup for ${baseFilename}`, err);
  }
}