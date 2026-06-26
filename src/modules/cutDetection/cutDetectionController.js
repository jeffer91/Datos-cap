const { logError } = require('../../services/loggerService');
const { analyzeCutsAndVisualRhythm } = require('./cutDetectionService');

async function handleAnalyzeCuts(payload) {
  try {
    return await analyzeCutsAndVisualRhythm(payload || {});
  } catch (error) {
    logError('Error al analizar cortes y ritmo visual', error, payload);
    return { ok: false, message: 'No se pudo analizar cortes y ritmo visual.', error: { message: error.message } };
  }
}

function handleCutDetectionDiagnostic() {
  return {
    ok: true,
    module: 'cutDetection',
    description: 'Módulo base de detección de cortes y ritmo visual.',
    eventTypes: ['cut_detected', 'high_visual_activity']
  };
}

module.exports = { handleAnalyzeCuts, handleCutDetectionDiagnostic };
