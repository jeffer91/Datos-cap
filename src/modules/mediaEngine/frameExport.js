const fs = require('fs');
const path = require('path');
const { ensureDir, getFileInfo } = require('../../services/fileService');
const { runFfmpeg } = require('./processRunner');

function calculateFrameInterval(durationSeconds, preferredInterval = 5, maxFrames = 300) {
  const duration = Number(durationSeconds) || 0;
  if (duration <= 0) return preferredInterval;
  const estimated = Math.ceil(duration / preferredInterval);
  if (estimated <= maxFrames) return preferredInterval;
  return Math.ceil(duration / maxFrames);
}

function listFrames(outputFolder) {
  if (!fs.existsSync(outputFolder)) return [];
  return fs
    .readdirSync(outputFolder)
    .filter((fileName) => fileName.toLowerCase().endsWith('.jpg'))
    .sort()
    .map((fileName) => getFileInfo(path.join(outputFolder, fileName)));
}

async function exportFrames({ videoPath, outputFolder, durationSeconds, preferredInterval = 5, maxFrames = 300 }) {
  if (!videoPath) throw new Error('No se recibió ruta de video.');
  if (!outputFolder) throw new Error('No se recibió carpeta destino de frames.');

  ensureDir(outputFolder);

  const intervalSeconds = calculateFrameInterval(durationSeconds, preferredInterval, maxFrames);
  const outputPattern = path.join(outputFolder, 'frame_%05d.jpg');

  await runFfmpeg([
    '-y',
    '-i',
    videoPath,
    '-vf',
    `fps=1/${intervalSeconds}`,
    '-q:v',
    '2',
    outputPattern
  ]);

  const frames = listFrames(outputFolder);

  return {
    ok: true,
    outputFolder,
    intervalSeconds,
    frameCount: frames.length,
    frames
  };
}

module.exports = {
  calculateFrameInterval,
  listFrames,
  exportFrames
};
