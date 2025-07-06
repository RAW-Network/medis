const videoService = require('../../services/video.service');
const YTDlpWrap = require('yt-dlp-wrap').default;
const CustomError = require('../../utils/CustomError');
const ytdlp = new YTDlpWrap();

exports.getVersion = async (req, res, next) => {
  try {
    const medisPackage = require('../../../package.json');
    const ytdlpVersion = await ytdlp.getVersion();
    res.json({
      medis: medisPackage.version || '1.0.0',
      ytdlp: ytdlpVersion,
    });
  } catch (error) {
    console.error('Failed to get version info:', error);
    res.status(500).json({ medis: '1.0.0', ytdlp: 'N/A' });
  }
};

exports.getSharePage = (req, res, next) => {
  try {
    const video = videoService.getVideoById(req.params.id);
    if (!video) {
      return res.status(404).send('Video not found');
    }

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
            html, body { background-color: #000; color: #fff; margin: 0; padding: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; }
            video { max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; }
        </style>
    </head>
    <body>
        <video controls autoplay playsinline>
            <source src="/videos/${video.filename}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    </body>
    </html>`;

    res.send(html);
  } catch (error) {
    next(error);
  }
};