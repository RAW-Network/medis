const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const CustomError = require('../utils/CustomError');
const websocketService = require('./websocket.service');

exports.getAllVideos = () => {
  const stmt = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC');
  return stmt.all();
};

exports.getVideoById = (id) => {
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(id);
};

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
  const video = this.getVideoById(id);
  if (!video) {
    throw new CustomError('Video not found in DB', 404);
  }

  const deleteTransaction = db.transaction(() => {
    try {
      const videoFilePath = path.join(config.videosPath, video.filename);
      if (fs.existsSync(videoFilePath)) {
        fs.unlinkSync(videoFilePath);
      }

      if (video.thumbnailUrl) {
        const thumbnailFilePath = path.join(config.videosPath, path.basename(video.thumbnailUrl));
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
  } catch(err) {
    console.error(`[SQLite Error] Transaction failed for deleting video ${id}:`, err);
    throw new CustomError('Failed to delete video due to a server error', 500);
  }
};

exports.cleanupOrphanedFiles = async () => {
    const getDbFilesStmt = db.prepare('SELECT filename, thumbnailUrl FROM videos');
    const dbVideos = getDbFilesStmt.all();

    const validFiles = new Set(['medis.db', 'medis.db-shm', 'medis.db-wal']);
    dbVideos.forEach(video => {
        if (video.filename) validFiles.add(video.filename);
        if (video.thumbnailUrl) validFiles.add(path.basename(video.thumbnailUrl));
    });

    const diskFiles = await fs.promises.readdir(config.videosPath);
    let deletedCount = 0;

    for (const file of diskFiles) {
        if (!validFiles.has(file)) {
            console.log(`[Startup] Found orphaned file: ${file}. Deleting...`);
            await fs.promises.unlink(path.join(config.videosPath, file));
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        console.log(`[Startup] Finished. Removed ${deletedCount} orphaned files.`);
    } else {
        console.log('[Startup] No orphaned files found. System is clean!');
    }
};