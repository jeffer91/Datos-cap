const crypto = require('crypto');
const { APP_CONFIG } = require('../../config/appConfig');
const { logInfo } = require('../../services/loggerService');
const { createVideo, listVideos, findVideoByLocalId } = require('../../database/repositories/videoRepository');
const { validateVideoImportPayload } = require('./videoValidator');
const { getBasicVideoMetadata } = require('./videoMetadataService');

function createLocalId() {
  const random = crypto.randomBytes(4).toString('hex');
  return `video_${Date.now()}_${random}`;
}

function getVideoImportOptions() {
  return {
    ok: true,
    styles: APP_CONFIG.defaultVideoStyles,
    analysisModes: APP_CONFIG.analysisModes,
    supportedVideoExtensions: APP_CONFIG.supportedVideoExtensions
  };
}

function importVideo(payload = {}) {
  const validation = validateVideoImportPayload(payload);
  if (!validation.ok) {
    return { ok: false, message: 'Datos inválidos.', errors: validation.errors };
  }

  const cleanPayload = validation.cleanPayload;
  const metadata = getBasicVideoMetadata(cleanPayload.sourcePath);
  const localId = createLocalId();

  const createdVideo = createVideo({
    local_id: localId,
    original_name: metadata.originalName,
    stored_name: metadata.originalName,
    creator_name: cleanPayload.creatorName || null,
    style_name: cleanPayload.styleName || 'Otro',
    topic: cleanPayload.topic || null,
    objective: cleanPayload.objective || null,
    source_path: cleanPayload.sourcePath,
    local_video_path: cleanPayload.sourcePath,
    duration_seconds: metadata.durationSeconds,
    fps: metadata.fps,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    status: 'imported',
    notes: cleanPayload.notes || null
  });

  logInfo('Video registrado correctamente', { localId, originalName: metadata.originalName });

  return {
    ok: true,
    message: 'Video registrado correctamente.',
    video: createdVideo,
    metadata,
    localVideoPath: cleanPayload.sourcePath,
    workFolders: null
  };
}

function listRecentImportedVideos(limit = 10) {
  const videos = listVideos({});
  return { ok: true, total: videos.length, videos: videos.slice(0, limit) };
}

function getImportedVideo(localId) {
  const video = findVideoByLocalId(localId);
  if (!video) return { ok: false, message: 'No se encontró el video solicitado.' };
  return { ok: true, video };
}

module.exports = { getVideoImportOptions, importVideo, listRecentImportedVideos, getImportedVideo };
