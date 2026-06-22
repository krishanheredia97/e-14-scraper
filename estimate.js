const fs = require('fs');
const path = require('path');

const METADATA_DIR = path.join(__dirname, 'metadata');
const RANDOM_DELAY_MIN_MS = 1000;
const RANDOM_DELAY_MAX_MS = 3000;
const PAGE_OVERHEAD_MS = 2500;

const allTransmissionCodes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'allTransmissionCodes.json'), 'utf8')
);

const totalNodes =
  allTransmissionCodes.data.status3.nodes.length +
  allTransmissionCodes.data.status11.nodes.length;

const metadataFiles = fs.existsSync(METADATA_DIR)
  ? fs.readdirSync(METADATA_DIR).filter((f) => f.endsWith('.json'))
  : [];

let downloadedCount = 0;
let totalDownloadedBytes = 0;
let measuredDurationCount = 0;
let totalMeasuredDurationMs = 0;

for (const file of metadataFiles) {
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, file), 'utf8'));
  } catch {
    continue;
  }

  if (typeof meta.sizeBytes !== 'number') continue;

  downloadedCount++;
  totalDownloadedBytes += meta.sizeBytes;

  if (typeof meta.downloadDurationMs === 'number') {
    measuredDurationCount++;
    totalMeasuredDurationMs += meta.downloadDurationMs;
  }
}

const avgSizeBytes = downloadedCount > 0 ? totalDownloadedBytes / downloadedCount : 0;
const estimatedTotalBytes = avgSizeBytes * totalNodes;
const remainingCount = totalNodes - downloadedCount;
const estimatedRemainingBytes = avgSizeBytes * remainingCount;

const avgDelayMs = (RANDOM_DELAY_MIN_MS + RANDOM_DELAY_MAX_MS) / 2;
const fallbackMsPerPdf = PAGE_OVERHEAD_MS + avgDelayMs;

const avgMsPerDownload = measuredDurationCount > 0
  ? totalMeasuredDurationMs / measuredDurationCount
  : fallbackMsPerPdf;

const estimatedRemainingMs = avgMsPerDownload * remainingCount;

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

console.log('PDF download estimate');
console.log('=====================');
console.log(`Total PDFs:           ${totalNodes.toLocaleString()}`);
console.log(`Downloaded so far:    ${downloadedCount.toLocaleString()}`);
console.log(`Remaining:            ${remainingCount.toLocaleString()}`);
console.log();
console.log(`Average PDF size:     ${formatBytes(avgSizeBytes)}`);
console.log(`Downloaded so far:    ${formatBytes(totalDownloadedBytes)}`);
console.log(`Estimated final size: ${formatBytes(estimatedTotalBytes)}`);
console.log(`Estimated remaining:  ${formatBytes(estimatedRemainingBytes)}`);
console.log();
console.log(`Measured samples:     ${measuredDurationCount.toLocaleString()}`);
console.log(`Avg time per PDF:     ${formatDuration(avgMsPerDownload)}`);
console.log(`Estimated remaining:  ${formatDuration(estimatedRemainingMs)}`);
console.log(`Completion (approx):  ${new Date(Date.now() + estimatedRemainingMs).toISOString()}`);
