/** Service for managing the video download process and lifecycle */
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
      const cookiesFilePath = path.join(config.cookiesPath, 'cookies.txt');
      const videoInfos = await ytdlpService.getPlaylistItems(url, config.playlistDownloadLimit, cookiesFilePath);

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
    const filename = `${videoId}.mp4`;
    const outputPath = path.join(config.videosPath, filename);
    const infoJsonPath = outputPath.replace('.mp4', '.info.json');
    
    // Initialize progress state before starting the download process
    websocketService.broadcast({ type: 'progress', stage: 'STARTING', message: 'Starting Download...', percent: 0, videoId });
    
    await ytdlpService.executeDownload(url, outputPath, cookiesFilePath, (percent, speed, eta) => {
      // Broadcast download metrics, capping visual progress at 98% during extraction
      websocketService.broadcast({
        type: 'progress',
        stage: 'DOWNLOADING',
        message: `Downloading ${Math.floor(percent)}%`,
        percent: percent >= 100 ? 98 : percent,
        speed,
        eta,
        videoId
      });
    });

    websocketService.broadcast({ type: 'progress', stage: 'PROCESSING', message: 'Merging video & audio...', percent: 99, videoId });

    // Parse metadata exported by yt-dlp
    let metadata = {};
    try {
      if (fs.existsSync(infoJsonPath)) {
        metadata = JSON.parse(fs.readFileSync(infoJsonPath, 'utf8'));
        // Clean up temporary metadata file
        fs.unlinkSync(infoJsonPath);
      }
    } catch(err) {
      console.error('Failed to parse info.json', err);
    }

    let finalThumbnailUrl = '';
    if (metadata.thumbnail) {
      websocketService.broadcast({ type: 'progress', stage: 'FETCHING_THUMBNAIL', message: 'Saving Thumbnail...', percent: 100, videoId });
      finalThumbnailUrl = await thumbnailService.download(metadata.thumbnail, videoId);
    }

    const newVideoData = {
      id: videoId,
      title: metadata.title || 'Untitled Video',
      originalUrl: url,
      filename,
      thumbnailUrl: finalThumbnailUrl,
      createdAt: new Date().toISOString(),
      width: metadata.width || 1280,
      height: metadata.height || 720
    };

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
  else if (errorMessage.includes('sign in') || errorMessage.includes('403: forbidden') || errorMessage.includes('empty media response')) userMessage = 'Video private or restricted. Please upload cookies.txt to /cookies!';
  else if (errorMessage.includes('no space left')) userMessage = 'Server out of storage space!';
  else if (errorMessage.includes('rate-limit')) userMessage = 'Rate limited by the platform. Try again later.';
  
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