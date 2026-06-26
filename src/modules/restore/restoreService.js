const fs = require('fs');
const path = require('path');

const { getStoragePaths } = require('../../services/pathService');
const { ensureDir, writeJson } = require('../../services/fileService');
const { logInfo, logError } = require('../../services/loggerService');
const { listLocalBackups } = require('../backup/backupService');
const { readBackupManifest } = require('./restoreManifestReader');
const {
  validateBackupStructure,
  compareBackupAgainstCurrent
} = require('./restoreValidator');

function exists(targetPath) {
  return Boolean(targetPath) && fs.existsSync(targetPath);
}

function getRestoreMapping(storagePaths) {
  return {
    database: {
      label: 'database',
      backupFolder: 'database',
      targetPath: storagePaths.database
    },
    analysisJson: {
      label: 'analysis_json',
      backupFolder: 'analysis_json',
      targetPath: storagePaths.analysisJson
    },
    templates: {
      label: 'templates',
      backupFolder: 'templates',
      targetPath: storagePaths.templates
    },
    transcripts: {
      label: 'transcripts',
      backupFolder: 'transcripts',
      targetPath: storagePaths.transcripts
    },
    reportsPdf: {
      label: 'reports_pdf',
      backupFolder: 'reports_pdf',
      targetPath: storagePaths.reportsPdf
    },
    reportsTxt: {
      label: 'reports_txt',
      backupFolder: 'reports_txt',
      targetPath: storagePaths.reportsTxt
    },
    logs: {
      label: 'logs',
      backupFolder: 'logs',
      targetPath: storagePaths.logs
    },
    videos: {
      label: 'videos',
      backupFolder: 'videos',
      targetPath: storagePaths.videos
    }
  };
}

function ensureLocalStructure() {
  const storagePaths = getStoragePaths();
  const createdOrChecked = [];

  Object.entries(storagePaths).forEach(([key, folderPath]) => {
    if (key === 'projectRoot') return;
    ensureDir(folderPath);
    createdOrChecked.push({ key, path: folderPath, ok: true });
  });

  return {
    ok: true,
    message: 'Estructura local verificada y reparada.',
    createdOrChecked
  };
}

function copyDirectoryControlled({ sourceDir, targetDir, overwrite = false }) {
  const copied = [];
  const skipped = [];
  const errors = [];

  if (!exists(sourceDir)) {
    return {
      ok: false,
      copied,
      skipped,
      errors: [{ sourceDir, message: 'Carpeta origen no existe.' }]
    };
  }

  ensureDir(targetDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  entries.forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    try {
      if (entry.isDirectory()) {
        const result = copyDirectoryControlled({ sourceDir: sourcePath, targetDir: targetPath, overwrite });
        copied.push(...result.copied);
        skipped.push(...result.skipped);
        errors.push(...result.errors);
        return;
      }

      if (entry.isFile()) {
        if (exists(targetPath) && !overwrite) {
          skipped.push({ sourcePath, targetPath, reason: 'Ya existe y overwrite está desactivado.' });
          return;
        }

        fs.copyFileSync(sourcePath, targetPath);
        copied.push({ sourcePath, targetPath });
      }
    } catch (error) {
      errors.push({ sourcePath, targetPath, message: error.message });
    }
  });

  return {
    ok: errors.length === 0,
    copied,
    skipped,
    errors
  };
}

function buildRestorePlan(payload = {}) {
  const storagePaths = getStoragePaths();
  const backupRoot = payload.backupRoot;
  const mapping = getRestoreMapping(storagePaths);

  const selected = {
    database: Boolean(payload.restoreDatabase),
    analysisJson: Boolean(payload.restoreAnalysisJson),
    templates: Boolean(payload.restoreTemplates),
    transcripts: Boolean(payload.restoreTranscripts),
    reportsPdf: Boolean(payload.restoreReportsPdf),
    reportsTxt: Boolean(payload.restoreReportsTxt),
    logs: Boolean(payload.restoreLogs),
    videos: Boolean(payload.restoreVideos)
  };

  const actions = Object.entries(selected)
    .filter(([, enabled]) => enabled)
    .map(([key]) => {
      const item = mapping[key];
      return {
        key,
        label: item.label,
        sourceDir: path.join(backupRoot || '', item.backupFolder),
        targetDir: item.targetPath,
        sourceExists: exists(path.join(backupRoot || '', item.backupFolder)),
        targetExists: exists(item.targetPath)
      };
    });

  return {
    ok: true,
    backupRoot,
    overwrite: Boolean(payload.overwrite),
    selected,
    actions,
    actionCount: actions.length
  };
}

function validateBackupForRestore(backupRoot) {
  const manifestResult = readBackupManifest(backupRoot);
  const structure = validateBackupStructure(backupRoot);
  const comparison = compareBackupAgainstCurrent({
    backupRoot,
    storagePaths: getStoragePaths()
  });

  return {
    ok: manifestResult.ok && structure.ok,
    manifest: manifestResult,
    structure,
    comparison
  };
}

function restoreBackupControlled(payload = {}) {
  try {
    if (payload.confirmText !== 'RESTAURAR') {
      return {
        ok: false,
        message: 'Restauración bloqueada. Escribe RESTAURAR para confirmar.',
        requiredConfirmText: 'RESTAURAR'
      };
    }

    const validation = validateBackupForRestore(payload.backupRoot);

    if (!validation.ok) {
      return {
        ok: false,
        message: 'El respaldo no pasó la validación. No se restauró nada.',
        validation
      };
    }

    const plan = buildRestorePlan(payload);

    if (!plan.actions.length) {
      return {
        ok: false,
        message: 'No seleccionaste ninguna carpeta para restaurar.',
        plan
      };
    }

    ensureLocalStructure();

    const results = plan.actions.map((action) => {
      const result = copyDirectoryControlled({
        sourceDir: action.sourceDir,
        targetDir: action.targetDir,
        overwrite: plan.overwrite
      });

      return {
        ...action,
        result
      };
    });

    const errors = results.flatMap((item) => item.result.errors || []);
    const copiedCount = results.reduce((sum, item) => sum + item.result.copied.length, 0);
    const skippedCount = results.reduce((sum, item) => sum + item.result.skipped.length, 0);

    const storagePaths = getStoragePaths();
    const restoreLogPath = path.join(storagePaths.logs, `restore_${Date.now()}.json`);

    const restoreLog = {
      generatedAt: new Date().toISOString(),
      payload: {
        backupRoot: payload.backupRoot,
        overwrite: plan.overwrite,
        selected: plan.selected
      },
      validation,
      plan,
      results,
      summary: {
        copiedCount,
        skippedCount,
        errorCount: errors.length
      }
    };

    writeJson(restoreLogPath, restoreLog);

    logInfo('Restauración controlada ejecutada', restoreLog.summary);

    return {
      ok: errors.length === 0,
      message: errors.length === 0 ? 'Restauración completada.' : 'Restauración completada con observaciones.',
      restoreLogPath,
      copiedCount,
      skippedCount,
      errors,
      results
    };
  } catch (error) {
    logError('Error al restaurar respaldo', error, payload);

    return {
      ok: false,
      message: 'No se pudo ejecutar la restauración controlada.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function getRestoreDiagnostic() {
  return {
    ok: true,
    module: 'restore',
    status: 'ready',
    features: [
      'listar respaldos',
      'validar respaldo',
      'comparar respaldo contra datos actuales',
      'vista previa de restauración',
      'restauración controlada con confirmación',
      'reparar estructura local'
    ]
  };
}

module.exports = {
  ensureLocalStructure,
  buildRestorePlan,
  validateBackupForRestore,
  restoreBackupControlled,
  getRestoreDiagnostic,
  listLocalBackups
};
