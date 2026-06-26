const fs = require('fs');
const path = require('path');

const { getStoragePaths } = require('../../services/pathService');
const { ensureDir, writeJson } = require('../../services/fileService');
const { logInfo, logError } = require('../../services/loggerService');
const { buildBackupManifest } = require('./backupManifestBuilder');

function createBackupId() {
  return `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function exists(targetPath) {
  return Boolean(targetPath) && fs.existsSync(targetPath);
}

function copyDirectoryRecursive(sourceDir, targetDir) {
  const copied = [];
  const errors = [];

  if (!exists(sourceDir)) {
    return { ok: false, copied, errors: [{ sourcePath: sourceDir, message: 'Carpeta origen no existe.' }] };
  }

  ensureDir(targetDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  entries.forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    try {
      if (entry.isDirectory()) {
        const result = copyDirectoryRecursive(sourcePath, targetPath);
        copied.push(...result.copied);
        errors.push(...result.errors);
        return;
      }

      if (entry.isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
        copied.push({ ok: true, type: 'file', sourcePath, targetPath });
      }
    } catch (error) {
      errors.push({ sourcePath, targetPath, message: error.message });
    }
  });

  return { ok: errors.length === 0, copied, errors };
}

function backupFolder({ label, sourceDir, targetRoot, copiedItems, errors }) {
  const targetDir = path.join(targetRoot, label);
  const result = copyDirectoryRecursive(sourceDir, targetDir);

  copiedItems.push({
    label,
    sourceDir,
    targetDir,
    copiedCount: result.copied.length,
    ok: result.ok
  });

  if (result.errors.length) errors.push(...result.errors);
}

function createLocalBackup(options = {}) {
  try {
    const includeVideos = Boolean(options.includeVideos);
    const storagePaths = getStoragePaths();
    const backupId = createBackupId();
    const backupsRoot = path.join(storagePaths.exports, 'backups');
    const backupRoot = path.join(backupsRoot, backupId);

    ensureDir(backupRoot);

    const copiedItems = [];
    const errors = [];

    backupFolder({ label: 'database', sourceDir: storagePaths.database, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'analysis_json', sourceDir: storagePaths.analysisJson, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'templates', sourceDir: storagePaths.templates, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'transcripts', sourceDir: storagePaths.transcripts, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'reports_pdf', sourceDir: storagePaths.reportsPdf, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'reports_txt', sourceDir: storagePaths.reportsTxt, targetRoot: backupRoot, copiedItems, errors });
    backupFolder({ label: 'logs', sourceDir: storagePaths.logs, targetRoot: backupRoot, copiedItems, errors });

    if (includeVideos) {
      backupFolder({ label: 'videos', sourceDir: storagePaths.videos, targetRoot: backupRoot, copiedItems, errors });
    }

    const manifest = buildBackupManifest({ backupId, backupRoot, includeVideos, storagePaths, copiedItems, errors });
    const manifestPath = path.join(backupRoot, 'backup_manifest.json');

    writeJson(manifestPath, manifest);

    logInfo('Respaldo local creado', { backupId, backupRoot, includeVideos });

    return {
      ok: errors.length === 0,
      message: errors.length === 0 ? 'Respaldo creado correctamente.' : 'Respaldo creado con observaciones.',
      backupId,
      backupRoot,
      manifestPath,
      includeVideos,
      copiedItems,
      errors
    };
  } catch (error) {
    logError('Error al crear respaldo local', error, options);
    return { ok: false, message: 'No se pudo crear el respaldo local.', error: { message: error.message, stack: error.stack } };
  }
}

function listLocalBackups() {
  const storagePaths = getStoragePaths();
  const backupsRoot = path.join(storagePaths.exports, 'backups');
  ensureDir(backupsRoot);

  const backups = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupRoot = path.join(backupsRoot, entry.name);
      const manifestPath = path.join(backupRoot, 'backup_manifest.json');
      let manifest = null;

      if (exists(manifestPath)) {
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) { manifest = null; }
      }

      return {
        backupId: entry.name,
        backupRoot,
        manifestPath,
        hasManifest: Boolean(manifest),
        generatedAt: manifest?.generatedAt || null,
        includeVideos: manifest?.includeVideos || false,
        copiedItems: manifest?.copiedItems || []
      };
    })
    .sort((a, b) => String(b.backupId).localeCompare(String(a.backupId)));

  return { ok: true, backupsRoot, total: backups.length, backups };
}

function getBackupDiagnostic() {
  const storagePaths = getStoragePaths();
  return {
    ok: true,
    module: 'backup',
    status: 'ready',
    backupsRoot: path.join(storagePaths.exports, 'backups'),
    features: ['crear respaldo local', 'listar respaldos', 'generar manifiesto JSON', 'incluir videos opcionalmente']
  };
}

module.exports = {
  createLocalBackup,
  listLocalBackups,
  getBackupDiagnostic,
  copyDirectoryRecursive
};
