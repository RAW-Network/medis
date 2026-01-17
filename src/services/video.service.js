const path = require('path');
const fs = require('fs');
const config = require('../config');
const CustomError = require('../utils/CustomError');
const websocketService = require('./websocket.service');
const videoRepository = require('../repositories/video.repository');

exports.getVideoById = (id) => {
  return videoRepository.findById(id);
};

exports.getAllVideos = () => {
  return videoRepository.findAll();
};

exports.createVideo = (videoData) => {
  return videoRepository.create(videoData);
};

exports.deleteVideoById = (id) => {
  const video = videoRepository.findById(id);

  if (!video) {
    throw new CustomError('Video not found in DB', 404);
  }

  const executeDelete = videoRepository.transaction(() => {
    try {
      if (video.filename) {
        const videoFilePath = path.join(config.videosPath, video.filename);
        if (fs.existsSync(videoFilePath)) {
          fs.unlinkSync(videoFilePath);
        }
      }

      if (video.thumbnailUrl) {
        const thumbnailFile = path.basename(video.thumbnailUrl);
        const thumbnailFilePath = path.join(config.thumbnailsPath, thumbnailFile);
        if (fs.existsSync(thumbnailFilePath)) {
          fs.unlinkSync(thumbnailFilePath);
        }
      }

      const info = videoRepository.delete(id);

      if (info.changes === 0) {
        throw new Error('Deletion from database failed unexpectedly');
      }
    } catch (fileErr) {
      console.error(fileErr);
      throw new Error('File deletion failed, rolling back DB change');
    }
  });

  try {
    executeDelete();
    websocketService.broadcast({ type: 'videoDeleted', videoId: id });
    websocketService.broadcast({
        type: 'VIDEO_DELETED', 
        payload: { id }
    });
  } catch (err) {
    console.error(err);
    throw new CustomError('Failed to delete video due to a server error', 500);
  }
};

exports.cleanupOrphanedFiles = async () => {
  const dbVideos = videoRepository.getAllFilenames();

  const validVideoFiles = new Set();
  const validThumbnailFiles = new Set();

  dbVideos.forEach((video) => {
    if (video.filename) {
      validVideoFiles.add(video.filename);
    }
    if (video.thumbnailUrl) {
      validThumbnailFiles.add(path.basename(video.thumbnailUrl));
    }
  });

  try {
    const videoDiskFiles = await fs.promises.readdir(config.videosPath);
    
    for (const file of videoDiskFiles) {
      if (!validVideoFiles.has(file)) {
        await fs.promises.unlink(path.join(config.videosPath, file));
      }
    }

    const thumbnailDiskFiles = await fs.promises.readdir(config.thumbnailsPath);
    
    for (const file of thumbnailDiskFiles) {
      if (!validThumbnailFiles.has(file)) {
        await fs.promises.unlink(path.join(config.thumbnailsPath, file));
      }
    }
  } catch (err) {
    console.error(err);
  }
};