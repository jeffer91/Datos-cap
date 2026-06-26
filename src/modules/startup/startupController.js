const { logError } = require('../../services/loggerService');
const {
  runStartupRepair,
  runStartupDiagnostic
} = require('./startupRepairService');

function handleStartupDiagnostic() {
  try {
    return runStartupDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de arranque', error);
    return {
      ok: false,
      message: 'No se pudo ejecutar el diagnóstico de arranque.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function handleStartupRepair() {
  try {
    return runStartupRepair();
  } catch (error) {
    logError('Error en reparación de arranque', error);
    return {
      ok: false,
      message: 'No se pudo reparar la estructura de arranque.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

module.exports = {
  handleStartupDiagnostic,
  handleStartupRepair
};
