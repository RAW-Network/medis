/** Main Express application configuration and middleware setup */
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const videoRoutes = require('./api/routes/video.routes');
const miscRoutes = require('./api/routes/misc.routes');
const errorHandler = require('./api/middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.resolve(__dirname, '../public')));

app.use('/videos', express.static(config.videosPath));
app.use('/thumbnails', express.static(config.thumbnailsPath));

app.use('/api', videoRoutes);

// Endpoint for saving and serving automatic UI testing recordings
const fs = require('fs');
app.post('/api/save-test-video', express.raw({ type: 'video/webm', limit: '50mb' }), (req, res, next) => {
  try {
    const videoPath = path.resolve(__dirname, '../data/ui-test.webm');
    fs.writeFileSync(videoPath, req.body);
    console.log('[Server] Automated UI test video saved successfully to:', videoPath);
    res.json({ success: true, path: '/api/test-video' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/test-video', (req, res, next) => {
  try {
    const videoPath = path.resolve(__dirname, '../data/ui-test.webm');
    if (!fs.existsSync(videoPath)) {
      return res.status(404).send('Test video not found. Run automated UI test first!');
    }
    res.setHeader('Content-Type', 'video/webm');
    res.sendFile(videoPath);
  } catch (err) {
    next(err);
  }
});

app.use('/', miscRoutes);

app.use(errorHandler);

module.exports = app;
