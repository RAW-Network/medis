const videoService = require('../../services/video.service');
const downloadService = require('../../services/download.service');
const wsService = require('../../services/websocket.service');
const { isValidUrl } = require('../../utils/security');
const CustomError = require('../../utils/CustomError');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

exports.downloadVideo = async (req, res, next) => {
  const { url } = req.body;

  try {
    if (!url || !isValidUrl(url)) {
      throw new CustomError('URL is invalid or not allowed.', 400);
    }

    console.log(`[API] POST /api/download - Request received for URL: ${url}`);

    const result = await downloadService.processUrl(url);

    res.status(result.status).json({ message: result.message });
  } catch (error) {
    next(error);
  }
};

exports.getVideos = (req, res, next) => {
  try {
    const videos = videoService.getAllVideos();
    console.log(`[API] GET /api/videos - Returning ${videos.length} videos`);
    res.status(200).json(videos);
  } catch (error) {
    next(error);
  }
};

exports.deleteVideo = (req, res, next) => {
  try {
    const { id } = req.params;
    videoService.deleteVideoById(id);
    
    wsService.broadcast({
      type: 'VIDEO_DELETED',
      payload: { id }
    });

    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.streamVideo = (req, res) => {
  const { filename } = req.params;

  const safeNamePattern = /^[0-9a-fA-F-]+\.mp4$/;

  if (!safeNamePattern.test(filename)) {
    return res.status(400).send('Invalid filename');
  }

  const videoPath = path.resolve(config.videosPath, filename);

  if (!videoPath.startsWith(path.resolve(config.videosPath))) {
    return res.status(400).send('Invalid filename');
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res
        .status(416)
        .send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    };

    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
};