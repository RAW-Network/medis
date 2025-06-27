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

const app = express();
const port = 3000;
const ytdlp = new YTDlpWrap();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let activeDownloads = 0;
let lastKnownSpeed = '0 B/s';
const MAX_ACTIVE_DOWNLOADS = 5;

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

wss.on('connection', (ws) => {
  console.log('WebSocket client connected.');
  ws.send(JSON.stringify({ type: 'status', activeDownloads, lastKnownSpeed }));
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

const dbPath = path.join(__dirname, 'videos', 'videos.json');
const videosPath = path.join(__dirname, 'videos');
if (!existsSync(videosPath)) mkdirSync(videosPath, { recursive: true });
if (!existsSync(dbPath)) {
  require('fs').writeFileSync(dbPath, JSON.stringify([]));
}

const readDB = async () => {
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify([]));
  }
  const data = await fs.readFile(dbPath);
  return JSON.parse(data);
};

const writeDB = async (data) => {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
};

app.get('/api/videos', async (req, res) => {
  const videos = await readDB();
  console.log(`[API] GET /api/videos - Returning ${videos.length} videos.`);
  res.json(videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  console.log(`[API] POST /api/download - Request received for URL: ${url}`);

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ message: 'URL is invalid or not allowed' });
  }

  if (activeDownloads >= MAX_ACTIVE_DOWNLOADS) {
    console.warn(`[SECURITY] Download limit reached. Denying new download request.`);
    return res.status(429).json({ message: 'Too many active downloads. Please wait.' });
  }

  res.status(202).json({ message: 'Download initiated' });

  const videoId = uuidv4();

  try {
    activeDownloads++;
    broadcast({ type: 'status', activeDownloads, lastKnownSpeed: '0 B/s' });

    console.log('[Backend] Step 1/3: Fetching video metadata...');
    const metadata = await ytdlp.getVideoInfo(url);

    console.log('[Backend] Step 2/3: Metadata received. Starting video file download...');
    
    let thumbnailFilename = '';
    let finalThumbnailUrl = '';

    if (metadata.thumbnail) {
      try {
        thumbnailFilename = `${videoId}-thumb.jpg`;
        const thumbnailPath = path.join(videosPath, thumbnailFilename);
        const response = await axios.get(metadata.thumbnail, { responseType: 'stream' });
        const writer = createWriteStream(thumbnailPath);
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        finalThumbnailUrl = `/videos/${thumbnailFilename}`;
      } catch (err) {
        console.error('[Backend] Failed to download thumbnail:', err.message);
      }
    }

    const newVideoData = {
      id: videoId,
      title: metadata.title || 'Untitled Video',
      originalUrl: url,
      filename: `${videoId}.mp4`,
      thumbnailUrl: finalThumbnailUrl,
      createdAt: new Date().toISOString()
    };

    const args = [
        url,
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', path.join(videosPath, newVideoData.filename),
        '--progress'
    ];

    const downloader = ytdlp.exec(args);

    downloader.on('progress', (progress) => {
      lastKnownSpeed = progress.speed || '0 B/s';
      broadcast({ type: 'progress', speed: lastKnownSpeed, percent: progress.percent });
    });

    downloader.on('close', async () => {
      console.log(`[Backend] Step 3/3: Video file download finished for "${newVideoData.title}".`);
      const videos = await readDB();
      videos.push(newVideoData);
      await writeDB(videos);
      activeDownloads--;
      lastKnownSpeed = '0 B/s';
      broadcast({ type: 'downloadComplete', video: newVideoData });
      broadcast({ type: 'status', activeDownloads, lastKnownSpeed });
      console.log(`[Backend] Download process fully complete.`);
    });

    downloader.on('error', async (err) => {
      console.error('[Backend] yt-dlp process error:', err.message);
      activeDownloads = Math.max(0, activeDownloads - 1);
      broadcast({ type: 'status', activeDownloads, lastKnownSpeed: '0 B/s' });

      const errorMessage = err.message.includes('The downloaded file is empty')
        ? 'Download failed: File is empty or protected.'
        : 'Download failed. Check server logs.';

      broadcast({ type: 'downloadError', message: errorMessage });
      await cleanupIncompleteFiles(videoId);
    });
  } catch (error) {
    console.error('[Backend] Main download process error:', error.message);
    activeDownloads = Math.max(0, activeDownloads - 1);
    broadcast({ type: 'status', activeDownloads, lastKnownSpeed: '0 B/s' });
    broadcast({ type: 'downloadError', message: 'Failed to fetch video info. Invalid link?' });
    await cleanupIncompleteFiles(videoId);
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  console.log(`[API] DELETE /api/videos/${id} - Deleting video.`);
  let videos = await readDB();
  const videoToDelete = videos.find(v => v.id === id);
  if (!videoToDelete) return res.status(404).json({ message: 'Video not found' });
  
  const videoFilePath = path.resolve(videosPath, videoToDelete.filename);
  const thumbnailFilePath = path.resolve(videosPath, `${id}-thumb.jpg`);

  if (!videoFilePath.startsWith(videosPath) || !thumbnailFilePath.startsWith(videosPath)) {
    console.error(`[SECURITY] Attempted path traversal for video ID: ${id}`);
    return res.status(400).json({ message: 'Invalid file path' });
  }

  try {
    await fs.access(videoFilePath);
    await fs.unlink(videoFilePath);
  } catch {}

  try {
    await fs.access(thumbnailFilePath);
    await fs.unlink(thumbnailFilePath);
  } catch {}

  const updatedVideos = videos.filter(v => v.id !== id);
  await writeDB(updatedVideos);
  broadcast({ type: 'videoDeleted' });
  res.status(200).json({ message: 'Video deleted successfully' });
});

app.get('/share/:id', async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).send('Invalid ID format');
  }

  const videos = await readDB();
  const video = videos.find(v => v.id === id);
  if (!video) return res.status(404).send('Video not found');

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  const videoUrl = `${baseUrl}/videos/${video.filename}`;
  const thumbnailUrl = video.thumbnailUrl || '';
  const shareUrl = `${baseUrl}/share/${video.id}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${video.title}</title>
        <meta name="twitter:card" content="player">
        <meta name="twitter:title" content="${video.title}">
        <meta name="twitter:player" content="${videoUrl}">
        <meta name="twitter:player:width" content="1280">
        <meta name="twitter:player:height" content="720">
        <meta name="twitter:image" content="${thumbnailUrl}">
        <meta property="og:type" content="video.other">
        <meta property="og:title" content="${video.title}">
        <meta property="og:url" content="${shareUrl}">
        <meta property="og:image" content="${thumbnailUrl}">
        <meta property="og:video" content="${videoUrl}">
        <meta property="og:video:secure_url" content="${videoUrl}">
        <meta property="og:video:type" content="video/mp4">
        <meta property="og:video:width" content="1280">
        <meta property="og:video:height" content="720">
        <style>body{background-color:#121212;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}video{max-width:90vw;max-height:90vh;}</style>
    </head>
    <body>
        <video controls autoplay>
            <source src="/videos/${video.filename}" type="video/mp4">
        </video>
    </body>
    </html>
  `;

  res.send(html);
});

async function cleanupIncompleteFiles(baseFilename) {
  try {
    console.log(`[Cleanup] Starting cleanup for base file: ${baseFilename}`);
    const files = await fs.readdir(videosPath);
    for (const file of files) {
      if (file.startsWith(baseFilename)) {
        await fs.unlink(path.join(videosPath, file));
        console.log(`[Cleanup] Deleted incomplete file: ${file}`);
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Error during file cleanup for ${baseFilename}:`, err);
  }
}

server.listen(port, () => {
  console.log(`MEDIS app running at http://localhost:${port}`);
});
