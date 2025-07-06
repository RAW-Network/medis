const express = require('express');
const { downloadVideo, getVideos, deleteVideo } = require('../controllers/video.controller');
const { validateId } = require('../middlewares/validator');

const router = express.Router();

router.post('/download', downloadVideo);
router.get('/videos', getVideos);
router.delete('/videos/:id', validateId, deleteVideo);

module.exports = router;