const { logError } = require('../../services/loggerService');
const {
  createLocalTranscriptDraft,
  getLocalTranscriptionDiagnostic
} = require('./localTranscriptionService');

function handleCreateTranscriptDraft(payload) {
  try {
    return createLocalTranscriptDraft(payload);
  } catch (error) {
    logError('Error al crear transcripción base', error, payload);
    return { ok: false, message: 'No se pudo crear la transcripción base.', error: { message: error.message } };
  }
}

function handleTranscriptionDiagnostic() {
  try {
    return getLocalTranscriptionDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de transcripción', error);
    return { ok: false, message: 'No se pudo verificar el módulo de transcripción.', error: { message: error.message } };
  }
}

module.exports = { handleCreateTranscriptDraft, handleTranscriptionDiagnostic };
