const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'videos');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

const db = new Database(path.join(dbPath, 'medis.db'));

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    originalUrl TEXT NOT NULL,
    filename TEXT NOT NULL,
    thumbnailUrl TEXT,
    createdAt TEXT NOT NULL,
    width INTEGER,
    height INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_videos_createdAt ON videos (createdAt);
`;

db.exec(createTableQuery);

console.log('[Database] SQLite Ready!');

module.exports = db;