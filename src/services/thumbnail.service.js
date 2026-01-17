const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');

exports.download = async (thumbnailUrl, videoId) => {
  try {
    const thumbnailFilename = `${videoId}-thumb.jpg`;
    const thumbnailPath = path.join(config.thumbnailsPath, thumbnailFilename);

    const response = await axios.get(thumbnailUrl, {
      responseType: 'stream',
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 5 * 1024 * 1024
    });

    const writer = fs.createWriteStream(thumbnailPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return `/thumbnails/${thumbnailFilename}`;
  } catch (err) {
    console.error(err.message);
    return '';
  }
};