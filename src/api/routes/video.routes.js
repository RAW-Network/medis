const express = require('express');
const { downloadVideo, getVideos, deleteVideo, streamVideo } = require('../controllers/video.controller');
const { validateId } = require('../middlewares/validator');

const router = express.Router();

router.post('/download', downloadVideo);
router.get('/videos', getVideos);
router.delete('/videos/:id', validateId, deleteVideo);
router.get('/stream/:filename', streamVideo);

module.exports = router;