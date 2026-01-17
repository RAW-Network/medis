const downloadQueue = [];
let activeDownloads = 0;

exports.add = (item) => {
  downloadQueue.push(item);
};

exports.next = () => {
  return downloadQueue.shift();
};

exports.isEmpty = () => {
  return downloadQueue.length === 0;
};

exports.isFull = (maxLimit, incomingCount = 1) => {
  if (!maxLimit) return false;
  return (activeDownloads + downloadQueue.length + incomingCount) > maxLimit;
};

exports.incrementActive = () => {
  activeDownloads++;
};

exports.decrementActive = () => {
  activeDownloads = Math.max(0, activeDownloads - 1);
};

exports.getStats = () => ({
  active: activeDownloads,
  queued: downloadQueue.length
});

exports.hasActiveDownloads = () => {
  return activeDownloads > 0;
};