/** Service for managing the download queue in the database */
const db = require('../config/database');

// Prepared statements for performance
const stmtAdd = db.prepare('INSERT INTO download_queue (url, jobId, status, createdAt) VALUES (?, ?, ?, ?)');
const stmtNextPending = db.prepare('SELECT id, url, jobId FROM download_queue WHERE status = ? ORDER BY id ASC LIMIT 1');
const stmtUpdateStatus = db.prepare('UPDATE download_queue SET status = ? WHERE id = ?');
const stmtDeleteById = db.prepare('DELETE FROM download_queue WHERE id = ?');
const stmtCountByStatus = db.prepare('SELECT COUNT(*) as count FROM download_queue WHERE status = ?');
const stmtResetActive = db.prepare("UPDATE download_queue SET status = 'pending' WHERE status = 'active'");

// On startup: recover from crash — reset any 'active' items back to 'pending'
const recovered = stmtResetActive.run();
if (recovered.changes > 0) {
  console.log(`[Queue] Recovered ${recovered.changes} active items back to pending after restart`);
}

let activeDownloads = 0;

exports.add = (item) => {
  stmtAdd.run(item.url, item.jobId, 'pending', new Date().toISOString());
};

exports.next = () => {
  const row = stmtNextPending.get('pending');
  if (!row) return null;
  stmtDeleteById.run(row.id);
  return { url: row.url, jobId: row.jobId };
};

exports.isEmpty = () => {
  const row = stmtCountByStatus.get('pending');
  return row.count === 0;
};

exports.isFull = (maxLimit, incomingCount = 1) => {
  if (!maxLimit) return false;
  const row = stmtCountByStatus.get('pending');
  return (activeDownloads + row.count + incomingCount) > maxLimit;
};

exports.incrementActive = () => {
  activeDownloads++;
};

exports.decrementActive = () => {
  activeDownloads = Math.max(0, activeDownloads - 1);
};

exports.getStats = () => {
  const row = stmtCountByStatus.get('pending');
  return {
    active: activeDownloads,
    queued: row.count
  };
};

exports.hasActiveDownloads = () => {
  return activeDownloads > 0;
};
