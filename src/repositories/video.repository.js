const db = require('../config/database');

exports.findById = (id) => {
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(id);
};

exports.findAll = () => {
  const stmt = db.prepare('SELECT * FROM videos ORDER BY createdAt DESC');
  return stmt.all();
};

exports.create = (videoData) => {
  const stmt = db.prepare(
    'INSERT INTO videos (id, title, originalUrl, filename, thumbnailUrl, createdAt, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  return stmt.run(
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

exports.delete = (id) => {
  const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
  return stmt.run(id);
};

exports.getAllFilenames = () => {
  const stmt = db.prepare('SELECT filename, thumbnailUrl FROM videos');
  return stmt.all();
};

exports.transaction = (fn) => {
  return db.transaction(fn);
};