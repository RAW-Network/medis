/** Service for managing the download queue in memory */

// In-memory array for tracking pending downloads
const pendingQueue = [];
let activeDownloads = 0;

exports.add = (item) => {
  pendingQueue.push({ url: item.url, jobId: item.jobId });
};

exports.next = () => {
  if (pendingQueue.length === 0) return null;
  return pendingQueue.shift();
};

exports.isEmpty = () => {
  return pendingQueue.length === 0;
};

exports.isFull = (maxLimit, incomingCount = 1) => {
  if (!maxLimit) return false;
  return (activeDownloads + pendingQueue.length + incomingCount) > maxLimit;
};

exports.incrementActive = () => {
  activeDownloads++;
};

exports.decrementActive = () => {
  activeDownloads = Math.max(0, activeDownloads - 1);
};

exports.getStats = () => {
  return {
    active: activeDownloads,
    queued: pendingQueue.length
  };
};

exports.hasActiveDownloads = () => {
  return activeDownloads > 0;
};