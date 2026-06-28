/** SQLite database configuration and initialization */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./index');

const dbDir = path.dirname(config.dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);

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

  CREATE TABLE IF NOT EXISTS download_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    jobId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue (status);
`;

db.exec(createTableQuery);

console.log('[Database] SQLite Ready!');

module.exports = db;
