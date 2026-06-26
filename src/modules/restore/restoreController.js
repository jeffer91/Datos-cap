const { logError } = require('../../services/loggerService');

const {
  ensureLocalStructure,
  buildRestorePlan,
  validateBackupForRestore,
  restoreBackupControlled,
  getRestoreDiagnostic,
  listLocalBackups
} = require('./restoreService');

function handleEnsureLocalStructure() {
  try {
    return ensureLocalStructure();
  } catch (error) {
    logError('Error al reparar estructura local', error);
    return {
      ok: false,
      message: 'No se pudo reparar la estructura local.',
      error: { message: error.message }
    };
  }
}

function handleListRestorableBackups() {
  try {
    return listLocalBackups();
  } catch (error) {
    logError('Error al listar respaldos restaurables', error);
    return {
      ok: false,
      message: 'No se pudieron listar los respaldos.',
      error: { message: error.message }
    };
  }
}

function handleValidateBackup(backupRoot) {
  try {
    return validateBackupForRestore(backupRoot);
  } catch (error) {
    logError('Error al validar respaldo', error, { backupRoot });
    return {
      ok: false,
      message: 'No se pudo validar el respaldo.',
      error: { message: error.message }
    };
  }
}

function handleBuildRestorePlan(payload) {
  try {
    return buildRestorePlan(payload || {});
  } catch (error) {
    logError('Error al construir plan de restauración', error, payload);
    return {
      ok: false,
      message: 'No se pudo crear el plan de restauración.',
      error: { message: error.message }
    };
  }
}

function handleRestoreBackupControlled(payload) {
  try {
    return restoreBackupControlled(payload || {});
  } catch (error) {
    logError('Error en controlador de restauración', error, payload);
    return {
      ok: false,
      message: 'No se pudo ejecutar la restauración.',
      error: { message: error.message, stack: error.stack }
    };
  }
}

function handleRestoreDiagnostic() {
  try {
    return getRestoreDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de restauración', error);
    return {
      ok: false,
      message: 'No se pudo verificar el módulo de restauración.',
      error: { message: error.message }
    };
  }
}

module.exports = {
  handleEnsureLocalStructure,
  handleListRestorableBackups,
  handleValidateBackup,
  handleBuildRestorePlan,
  handleRestoreBackupControlled,
  handleRestoreDiagnostic
};
