const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const CustomError = require('../utils/CustomError');
const websocketService = require('./websocket.service');

const getVideoById = (id) => {
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(id);
};

exports.getAllVideos = () => {
  const stmt = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC');
  return stmt.all();
};

exports.getVideoById = getVideoById;

exports.createVideo = (videoData) => {
  const stmt = db.prepare(
    'INSERT INTO videos (id, title, originalUrl, filename, thumbnailUrl, createdAt, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    videoData.id,
    videoData.title,
    videoData.originalUrl,
    videoData.filename,
    videoData.thumbnailUrl,
    videoData.createdAt,
    videoData.width,
    videoData.height
  );
};

exports.deleteVideoById = (id) => {
  const video = getVideoById(id);

  if (!video) {
    throw new CustomError('Video not found in DB', 404);
  }

  const deleteTransaction = db.transaction(() => {
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

      const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
      const info = stmt.run(id);

      if (info.changes === 0) {
        throw new Error('Deletion from database failed unexpectedly.');
      }
    } catch (fileErr) {
      console.error(`[DELETE-ERROR] Failed to delete files for ${id}, rolling back DB change.`, fileErr);
      throw new Error('File deletion failed, rolling back DB change.');
    }
  });

  try {
    deleteTransaction();
    websocketService.broadcast({ type: 'videoDeleted', videoId: id });
  } catch (err) {
    console.error(`[SQLite Error] Transaction failed for deleting video ${id}:`, err);
    throw new CustomError('Failed to delete video due to a server error', 500);
  }
};

exports.cleanupOrphanedFiles = async () => {
  const getDbFilesStmt = db.prepare('SELECT filename, thumbnailUrl FROM videos');
  const dbVideos = getDbFilesStmt.all();

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
    let deletedVideoCount = 0;

    for (const file of videoDiskFiles) {
      if (!validVideoFiles.has(file)) {
        await fs.promises.unlink(path.join(config.videosPath, file));
        deletedVideoCount++;
      }
    }

    const thumbnailDiskFiles = await fs.promises.readdir(config.thumbnailsPath);
    let deletedThumbCount = 0;

    for (const file of thumbnailDiskFiles) {
      if (!validThumbnailFiles.has(file)) {
        await fs.promises.unlink(path.join(config.thumbnailsPath, file));
        deletedThumbCount++;
      }
    }

    if (deletedVideoCount > 0 || deletedThumbCount > 0) {
      console.log(
        `[Startup] Removed ${deletedVideoCount} orphaned video files and ${deletedThumbCount} orphaned thumbnail files.`
      );
    } else {
      console.log('[Startup] No orphaned files found. System is clean!');
    }
  } catch (err) {
    console.error('[Startup] Error while cleaning orphaned files', err);
  }
};
