const { logError } = require('../../services/loggerService');
const { createLocalBackup, listLocalBackups, getBackupDiagnostic } = require('./backupService');

function handleCreateLocalBackup(payload) {
  try {
    return createLocalBackup(payload || {});
  } catch (error) {
    logError('Error en controlador de respaldo', error, payload);
    return { ok: false, message: 'No se pudo crear el respaldo.', error: { message: error.message, stack: error.stack } };
  }
}

function handleListLocalBackups() {
  try {
    return listLocalBackups();
  } catch (error) {
    logError('Error al listar respaldos', error);
    return { ok: false, message: 'No se pudieron listar los respaldos.', error: { message: error.message } };
  }
}

function handleBackupDiagnostic() {
  try {
    return getBackupDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de respaldo', error);
    return { ok: false, message: 'No se pudo verificar el módulo de respaldo.', error: { message: error.message } };
  }
}

module.exports = {
  handleCreateLocalBackup,
  handleListLocalBackups,
  handleBackupDiagnostic
};
