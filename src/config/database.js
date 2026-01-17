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
`;

db.exec(createTableQuery);

console.log('[Database] SQLite Ready!');

module.exports = db;
