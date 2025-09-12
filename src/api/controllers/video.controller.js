const videoService = require('../../services/video.service');
const downloadService = require('../../services/download.service');
const { isValidUrl } = require('../../utils/security');
const CustomError = require('../../utils/CustomError');

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
        videoService.deleteVideoById(req.params.id);
        res.status(200).json({ message: 'Video deleted successfully' });
    } catch (error) {
        next(error);
    }
};