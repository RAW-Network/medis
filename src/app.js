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
app.use('/', miscRoutes);

app.use(errorHandler);

module.exports = app;
