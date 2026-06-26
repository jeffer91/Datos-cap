const {
  getVideoImportOptions,
  importVideo,
  listRecentImportedVideos,
  getImportedVideo
} = require('./videoImportService');

const { logError } = require('../../services/loggerService');

function handleGetVideoImportOptions() {
  try {
    return getVideoImportOptions();
  } catch (error) {
    logError('Error al obtener opciones de importación de video', error);
    return { ok: false, message: 'No se pudieron cargar las opciones de importación.', error: { message: error.message } };
  }
}

function handleImportVideo(payload) {
  try {
    return importVideo(payload);
  } catch (error) {
    logError('Error al importar video', error, payload);
    return { ok: false, message: 'Ocurrió un error al importar el video.', error: { message: error.message, stack: error.stack } };
  }
}

function handleListRecentImportedVideos(limit) {
  try {
    return listRecentImportedVideos(limit);
  } catch (error) {
    logError('Error al listar videos importados', error);
    return { ok: false, message: 'No se pudieron listar los videos importados.', error: { message: error.message } };
  }
}

function handleGetImportedVideo(localId) {
  try {
    return getImportedVideo(localId);
  } catch (error) {
    logError('Error al obtener video importado', error, { localId });
    return { ok: false, message: 'No se pudo obtener el video importado.', error: { message: error.message } };
  }
}

module.exports = {
  handleGetVideoImportOptions,
  handleImportVideo,
  handleListRecentImportedVideos,
  handleGetImportedVideo
};
