const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const fs = require('fs').promises;
const { existsSync, mkdirSync, createWriteStream } = require('fs');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('./db.js');

const app = express();
const port = 3000;
const ytdlp = new YTDlpWrap();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const MAX_QUEUE_LIMIT = parseInt(process.env.MAX_QUEUE_LIMIT, 10) || 5;

let activeDownloads = 0;
const downloadQueue = [];
let isDownloading = false;

const isPlaylistUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const playlistRegex = /(\?|&)list=|(\/playlists\/)/;
    return playlistRegex.test(parsedUrl.search) || playlistRegex.test(parsedUrl.pathname);
  } catch {
    return false;
  }
};

const isValidUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    const { hostname } = parsedUrl;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};

const isUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function handleDownloadError(error, videoId) {
    let userMessage = 'An unknown download error occurred. Please check the server logs for more details';
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('unsupported url')) {
        userMessage = 'The provided URL is not supported';
    } else if (errorMessage.includes('video unavailable')) {
        userMessage = 'This video is unavailable or has been removed';
    } else if (errorMessage.includes('fragment') || errorMessage.includes('403: forbidden')) {
        userMessage = 'Download failed (403 Forbidden). This video may be private or regionally restricted. Using a cookies file might help';
    } else if (errorMessage.includes('the downloaded file is empty')) {
        userMessage = 'Download failed: The file is empty, possibly due to regional restrictions or protection';
    } else if (errorMessage.includes('404')) {
        userMessage = 'Could not find the video. Please check the URL';
    } else if (errorMessage.includes('metadata extraction failed')) {
        userMessage = 'Failed to get video info. The URL might be incorrect or private';
    }

    console.error(`[Backend Error] For video ${videoId}:`, error.message);
    broadcast({ type: 'downloadError', message: userMessage, videoId: videoId });

    if (videoId) {
        cleanupIncompleteFiles(videoId).catch(cleanupErr => {
            console.error(`[Cleanup] Nested error during cleanup for ${videoId}:`, cleanupErr);
        });
    }
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected.');
  ws.send(JSON.stringify({ type: 'status', activeDownloads, queueSize: downloadQueue.length }));
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

const videosPath = path.join(__dirname, 'videos');
const cookiesDirPath = path.join(__dirname, 'cookies');

if (!existsSync(videosPath)) mkdirSync(videosPath, { recursive: true });
if (!existsSync(cookiesDirPath)) mkdirSync(cookiesDirPath, { recursive: true });

app.get('/api/videos', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC');
    const videos = stmt.all();
    console.log(`[API] GET /api/videos - Returning ${videos.length} videos`);
    res.json(videos);
  } catch (error) {
    console.error('[SQLite Error] Failed to fetch videos:', error);
    res.status(500).json({ message: 'Failed to retrieve video data' });
  }
});

app.get('/api/version', async (req, res) => {
  try {
    const medisPackage = require('./package.json');
    const ytdlpVersion = await ytdlp.getVersion();
    res.json({
      medis: medisPackage.version || '1.0.0',
      ytdlp: ytdlpVersion,
    });
  } catch (error) {
    console.error('Failed to get version info:', error);
    res.status(500).json({ medis: '1.0.0', ytdlp: 'N/A' });
  }
});

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    console.log(`[API] POST /api/download - Request received for URL: ${url}`);

    if (isPlaylistUrl(url)) {
        console.warn(`[SECURITY] Playlist URL detected and blocked immediately: ${url}`);
        return res.status(400).json({ message: 'Downloading playlists is not allowed' });
    }

    if (!url || !isValidUrl(url)) {
        return res.status(400).json({ message: 'URL is invalid or not allowed' });
    }

    if ((activeDownloads + downloadQueue.length) >= MAX_QUEUE_LIMIT) {
        console.warn(`[Queue] Total job limit reached. Rejecting new download request. Limit: ${MAX_QUEUE_LIMIT}`);
        return res.status(429).json({ message: `Queue limit reached (max: ${MAX_QUEUE_LIMIT}). Please try again later` });
    }
    
    const jobId = uuidv4();

    if (isDownloading) {
        downloadQueue.push({ url, jobId });
        broadcast({ type: 'status', activeDownloads, queueSize: downloadQueue.length });
        console.log(`[Queue] Download added to queue. Current queue size: ${downloadQueue.length}`);
        return res.status(202).json({ message: 'Download has been added to the queue' });
    }

    res.status(202).json({ message: 'Download initiated' });
    startDownload({ url, jobId });
});

async function startDownload(downloadJob) {
    const { url, jobId } = downloadJob;
    isDownloading = true;
    activeDownloads++;
    broadcast({ type: 'status', activeDownloads, queueSize: downloadQueue.length });

    const videoId = jobId;
    let metadata;

    try {
        broadcast({ type: 'progress', stage: 'FETCHING_METADATA', message: 'Fetching video info...', percent: 0, videoId });
        
        const cookiesFilePath = path.join(cookiesDirPath, 'cookies.txt');
        const commonArgs = [];

        try {
            await fs.access(cookiesFilePath);
            commonArgs.push('--cookies', cookiesFilePath);
        } catch {
        }

        const infoArgs = [...commonArgs, '--dump-json', '--', url];
        const stdout = await ytdlp.execPromise(infoArgs);
        metadata = JSON.parse(stdout);
        
        let finalThumbnailUrl = '';

        broadcast({ type: 'progress', stage: 'FETCHING_THUMBNAIL', message: 'Fetching thumbnail...', percent: 0, videoId });
        
        if (metadata.thumbnail) {
            try {
                const thumbnailFilename = `${videoId}-thumb.jpg`;
                const thumbnailPath = path.join(videosPath, thumbnailFilename);
                
                const response = await axios.get(metadata.thumbnail, { 
                    responseType: 'stream',
                    maxContentLength: 5 * 1024 * 1024,
                    maxBodyLength: 5 * 1024 * 1024 
                });

                const writer = createWriteStream(thumbnailPath);
                await new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                finalThumbnailUrl = `/videos/${thumbnailFilename}`;
            } catch (err) {
                console.error('[AXIOS-ERROR] Failed to download thumbnail:', err.message);
            }
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
        
        broadcast({ type: 'progress', stage: 'DOWNLOADING', message: 'Downloading video...', percent: 0, videoId });

        const downloadArgs = [
            url,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', path.join(videosPath, newVideoData.filename),
            '--progress',
            '--no-part',
            '--merge-output-format', 'mp4',
            ...commonArgs
        ];

        const downloader = ytdlp.exec(downloadArgs);

        downloader.on('progress', (progress) => {
            const percent = parseFloat(progress.percent);
            if(!isNaN(percent)) {
                broadcast({ type: 'progress', stage: 'DOWNLOADING', message: `Downloading video... ${Math.floor(percent)}%`, percent: percent, videoId });
            }
        });

        downloader.on('close', async () => {
            broadcast({ type: 'progress', stage: 'PROCESSING', message: 'Processing video...', percent: 100, videoId });
            
            try {
                 const stmt = db.prepare('INSERT INTO videos (id, title, originalUrl, filename, thumbnailUrl, createdAt, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                 stmt.run(newVideoData.id, newVideoData.title, newVideoData.originalUrl, newVideoData.filename, newVideoData.thumbnailUrl, newVideoData.createdAt, newVideoData.width, newVideoData.height);
                 broadcast({ type: 'downloadComplete', video: newVideoData });
            } catch (dbError) {
                console.error("[SQLite Error] Failed to save metadata:", dbError);
            } finally {
                finishDownload();
            }
        });

        downloader.on('error', (err) => {
            handleDownloadError(err, videoId);
            finishDownload();
        });

    } catch (error) {
        error.message = `Metadata extraction failed: ${error.message}`;
        handleDownloadError(error, videoId);
        finishDownload();
    }
}

function finishDownload() {
    activeDownloads = Math.max(0, activeDownloads - 1);
    isDownloading = false;
    broadcast({ type: 'status', activeDownloads, queueSize: downloadQueue.length });
    processNextInQueue();
}

function processNextInQueue() {
    if (downloadQueue.length > 0 && !isDownloading) {
        const nextDownload = downloadQueue.shift();
        console.log(`[Queue] Starting next download from queue. Queue size: ${downloadQueue.length}`);
        startDownload(nextDownload);
    } else {
        console.log('[Queue] Queue is empty or a download is already in progress');
    }
}

app.delete('/api/videos/:id', async (req, res) => {
    const { id } = req.params;

    if (!isUuid(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const deleteTransaction = db.transaction((videoId) => {
        const getVideoStmt = db.prepare('SELECT filename, thumbnailUrl FROM videos WHERE id = ?');
        const videoToDelete = getVideoStmt.get(videoId);

        if (!videoToDelete) {
            return { success: false, status: 404, message: 'Video not found in DB' };
        }

        const deleteStmt = db.prepare('DELETE FROM videos WHERE id = ?');
        const info = deleteStmt.run(videoId);

        if (info.changes === 0) {
            throw new Error('Deletion from database failed unexpectedly.');
        }

        try {
            const videoFilePath = path.join(videosPath, videoToDelete.filename);
            if (existsSync(videoFilePath)) {
                fs.unlink(videoFilePath);
            }

            if (videoToDelete.thumbnailUrl) {
                const thumbnailFilePath = path.join(videosPath, path.basename(videoToDelete.thumbnailUrl));
                if (existsSync(thumbnailFilePath)) {
                    fs.unlink(thumbnailFilePath);
                }
            }
        } catch (fileErr) {
            console.error(`[DELETE-ERROR] Failed to delete files for ${videoId}, rolling back DB change.`, fileErr);
            throw new Error('File deletion failed, rolling back DB change.');
        }
        
        return { success: true, status: 200, message: 'Video deleted successfully' };
    });

    try {
        const result = deleteTransaction(id);
        res.status(result.status).json({ message: result.message });
    } catch (error) {
        console.error(`[SQLite Error] Transaction failed for deleting video ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete video due to a server error' });
    }
});

app.get('/share/:id', (req, res) => {
    const { id } = req.params;

    if (!isUuid(id)) {
        return res.status(400).send('Invalid ID format');
    }

    let video;
    try {
        const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
        video = stmt.get(id);
    } catch (error) {
        console.error(`[SQLite Error] Failed to fetch video for sharing ${id}:`, error);
        return res.status(500).send('Error retrieving video data');
    }
    
    if (!video) return res.status(404).send('Video not found');

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const videoUrl = `${baseUrl}/videos/${video.filename}`;
    const thumbnailUrl = video.thumbnailUrl ? `${baseUrl}${video.thumbnailUrl}` : '';
    const shareUrl = `${baseUrl}/share/${video.id}`;
  
    const videoWidth = video.width || 1280;
    const videoHeight = video.height || 720;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${video.title}</title>
        <meta name="twitter:card" content="player">
        <meta name="twitter:title" content="${video.title}">
        <meta name="twitter:player" content="${videoUrl}">
        <meta name="twitter:player:width" content="${videoWidth}">
        <meta name="twitter:player:height" content="${videoHeight}">
        <meta name="twitter:image" content="${thumbnailUrl}">
        <meta property="og:type" content="video.other">
        <meta property="og:title" content="${video.title}">
        <meta property="og:url" content="${shareUrl}">
        <meta property="og:image" content="${thumbnailUrl}">
        <meta property="og:video" content="${videoUrl}">
        <meta property="og:video:secure_url" content="${videoUrl}">
        <meta property="og:video:type" content="video/mp4">
        <meta property="og:video:width" content="${videoWidth}">
        <meta property="og:video:height" content="${videoHeight}">
        <style>
            html, body {
                background-color: #000;
                color: #fff;
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
            }
            video {
                max-width: 100vw;
                max-height: 100vh;
                width: auto;
                height: auto;
                object-fit: contain; 
            }
        </style>
    </head>
    <body>
        <video controls autoplay playsinline>
            <source src="/videos/${video.filename}" type="video/mp4">
            Your browser does not support the video tag
        </video>
    </body>
    </html>
  `;

  res.send(html);
});

async function cleanupIncompleteFiles(baseFilename) {
  try {
    const files = await fs.readdir(videosPath);
    for (const file of files) {
      if (file.startsWith(baseFilename)) {
        await fs.unlink(path.join(videosPath, file));
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Error during file cleanup for ${baseFilename}:`, err);
  }
}

async function cleanupOrphanedFilesOnStartup() {
    try {
        const getDbFilesStmt = db.prepare('SELECT filename, thumbnailUrl FROM videos');
        const dbVideos = getDbFilesStmt.all();

        const validFiles = new Set(['medis.db', 'medis.db-shm', 'medis.db-wal']);
        dbVideos.forEach(video => {
            if (video.filename) validFiles.add(video.filename);
            if (video.thumbnailUrl) validFiles.add(path.basename(video.thumbnailUrl));
        });

        const diskFiles = await fs.readdir(videosPath);
        let deletedCount = 0;

        for (const file of diskFiles) {
            if (!validFiles.has(file)) {
                console.log(`[Startup Cleanup] Found orphaned file: ${file}. Deleting...`);
                await fs.unlink(path.join(videosPath, file));
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            console.log(`[Startup Cleanup] Finished. Removed ${deletedCount} orphaned files.`);
        } else {
            console.log('[Startup Cleanup] No orphaned files found. System is clean.');
        }
    } catch (err) {
        console.error('[Startup Cleanup] An error occurred during cleanup:', err);
    }
}

(async () => {
    console.log('[Startup] Resetting active download counter');
    activeDownloads = 0;
    
    await cleanupOrphanedFilesOnStartup();

    console.log(`[Config] Maximum queue limit set to: ${MAX_QUEUE_LIMIT}`);
    server.listen(port, () => {
      console.log(`MEDIS app running at http://localhost:${port}`);
    });
})();