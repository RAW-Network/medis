const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const videoService = require('./video.service');
const websocketService = require('./websocket.service');
const thumbnailService = require('./thumbnail.service');
const ytdlpService = require('./ytdlp.service');
const queueService = require('./queue.service');
const CustomError = require('../utils/CustomError');
const { isPlaylistUrl } = require('../utils/security');

exports.processUrl = async (url) => {
  if (isPlaylistUrl(url)) {
    console.log('[Queue] Playlist detected. Processing playlist URL');
    try {
      const videoInfos = await ytdlpService.getPlaylistItems(url, config.playlistDownloadLimit);

      if (videoInfos.length === 0) {
        throw new CustomError('Could not find any videos in the provided playlist', 404);
      }

      if (queueService.isFull(config.maxQueueLimit, videoInfos.length)) {
        throw new CustomError(
          `Adding ${videoInfos.length} videos would exceed the queue limit (max: ${config.maxQueueLimit})`,
          429
        );
      }

      videoInfos.forEach((video) => {
        if (video.url) enqueueItem(video.url);
      });

      return { status: 202, message: `Playlist processed. Added ${videoInfos.length} videos to the queue` };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('sign in') || msg.includes('private')) {
        throw new CustomError('This playlist is private or requires login', 403);
      }
      throw new CustomError('Failed to fetch playlist details', 500);
    }
  }

  return enqueueItem(url);
};

function enqueueItem(url) {
  if (queueService.isFull(config.maxQueueLimit)) {
    throw new CustomError(`Queue limit reached (max: ${config.maxQueueLimit}). Please try again later`, 429);
  }

  const jobId = uuidv4();
  
  if (queueService.hasActiveDownloads()) {
    queueService.add({ url, jobId });
    updateWsStatus();
    return { status: 202, message: 'Download has been added to the queue' };
  }

  startDownload({ url, jobId });
  return { status: 202, message: 'Download initiated' };
}

async function processNextInQueue() {
  if (queueService.hasActiveDownloads() || queueService.isEmpty()) return;
  const nextDownload = queueService.next();
  await startDownload(nextDownload);
}

function updateWsStatus() {
  const stats = queueService.getStats();
  websocketService.updateStatus(stats.active, stats.queued);
}

async function startDownload({ url, jobId }) {
  queueService.incrementActive();
  updateWsStatus();

  const videoId = jobId;
  const cookiesFilePath = path.join(config.cookiesPath, 'cookies.txt');

  try {
    websocketService.broadcast({ type: 'progress', stage: 'FETCHING_METADATA', message: 'Fetching Metadata', videoId });

    const metadata = await ytdlpService.getMetadata(url, cookiesFilePath);

    websocketService.broadcast({ type: 'progress', stage: 'FETCHING_THUMBNAIL', message: 'Fetching Thumbnail', videoId });

    let finalThumbnailUrl = '';
    if (metadata.thumbnail) {
      finalThumbnailUrl = await thumbnailService.download(metadata.thumbnail, videoId);
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

    const outputPath = path.join(config.videosPath, newVideoData.filename);
    
    await ytdlpService.executeDownload(url, outputPath, cookiesFilePath, (percent) => {
      websocketService.broadcast({
        type: 'progress',
        stage: 'DOWNLOADING',
        message: `Downloading Video ${Math.floor(percent)}%`,
        percent,
        videoId
      });
    });

    websocketService.broadcast({ type: 'progress', stage: 'PROCESSING', message: 'Processing Video', percent: 100, videoId });
    videoService.createVideo(newVideoData);
    websocketService.broadcast({ type: 'downloadComplete', video: newVideoData });

  } catch (error) {
    handleDownloadError(error, videoId);
  } finally {
    queueService.decrementActive();
    updateWsStatus();
    processNextInQueue();
  }
}

function handleDownloadError(error, videoId) {
  let userMessage = 'An unknown download error occurred';
  const errorMessage = String(error.message || '').toLowerCase();

  if (errorMessage.includes('unsupported url')) userMessage = 'The provided URL is not supported';
  else if (errorMessage.includes('video unavailable')) userMessage = 'This video is unavailable or has been removed';
  else if (errorMessage.includes('sign in') || errorMessage.includes('403: forbidden')) userMessage = 'Video private or restricted. Try using cookies!';
  
  console.error(`[Download Error] ${videoId}:`, error.message);

  websocketService.broadcast({ type: 'downloadError', message: userMessage, videoId });
  cleanupIncompleteFiles(videoId);
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
    console.error(err);
  }
}