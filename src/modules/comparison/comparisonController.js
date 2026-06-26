const { logError } = require('../../services/loggerService');

const {
  listComparableAnalyses,
  compareAnalyses,
  getComparisonDiagnostic
} = require('./comparisonService');

function handleListComparableAnalyses(limit) {
  try {
    return listComparableAnalyses(limit || 50);
  } catch (error) {
    logError('Error al listar análisis comparables', error);
    return {
      ok: false,
      message: 'No se pudieron listar los análisis comparables.',
      error: { message: error.message }
    };
  }
}

function handleCompareAnalyses(payload) {
  try {
    return compareAnalyses(payload || {});
  } catch (error) {
    logError('Error al comparar análisis', error, payload);
    return {
      ok: false,
      message: 'No se pudo comparar los análisis seleccionados.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function handleComparisonDiagnostic() {
  try {
    return getComparisonDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de comparación', error);
    return {
      ok: false,
      message: 'No se pudo verificar el módulo de comparación.',
      error: { message: error.message }
    };
  }
}

module.exports = {
  handleListComparableAnalyses,
  handleCompareAnalyses,
  handleComparisonDiagnostic
};
