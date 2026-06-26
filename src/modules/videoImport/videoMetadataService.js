const path = require('path');
const { getFileInfo } = require('../../services/fileService');

function getBasicVideoMetadata(filePath) {
  const fileInfo = getFileInfo(filePath);

  if (!fileInfo.exists || !fileInfo.isFile) {
    throw new Error('No se pudo leer la información básica del video.');
  }

  return {
    originalName: fileInfo.name,
    extension: path.extname(fileInfo.name).toLowerCase(),
    sizeBytes: fileInfo.sizeBytes,
    createdAt: fileInfo.createdAt,
    modifiedAt: fileInfo.modifiedAt,
    durationSeconds: null,
    fps: null,
    width: null,
    height: null,
    format: path.extname(fileInfo.name).replace('.', '').toLowerCase()
  };
}

module.exports = { getBasicVideoMetadata };
