const fs = require('fs');
const path = require('path');

const REQUIRED_BACKUP_FOLDERS = [
  'database',
  'analysis_json',
  'templates',
  'transcripts',
  'reports_pdf',
  'reports_txt',
  'logs'
];

function exists(targetPath) {
  return Boolean(targetPath) && fs.existsSync(targetPath);
}

function countFilesRecursive(folderPath) {
  if (!exists(folderPath)) return 0;

  let count = 0;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  entries.forEach((entry) => {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      count += countFilesRecursive(fullPath);
      return;
    }

    if (entry.isFile()) {
      count += 1;
    }
  });

  return count;
}

function validateBackupStructure(backupRoot) {
  const checks = [];

  checks.push({
    key: 'backupRoot',
    path: backupRoot,
    ok: exists(backupRoot),
    message: exists(backupRoot) ? 'Carpeta de respaldo encontrada.' : 'No existe la carpeta de respaldo.'
  });

  const manifestPath = path.join(backupRoot || '', 'backup_manifest.json');

  checks.push({
    key: 'manifest',
    path: manifestPath,
    ok: exists(manifestPath),
    message: exists(manifestPath) ? 'Manifiesto encontrado.' : 'No se encontró backup_manifest.json.'
  });

  REQUIRED_BACKUP_FOLDERS.forEach((folderName) => {
    const folderPath = path.join(backupRoot || '', folderName);

    checks.push({
      key: folderName,
      path: folderPath,
      ok: exists(folderPath),
      fileCount: countFilesRecursive(folderPath),
      message: exists(folderPath) ? 'Carpeta encontrada.' : 'Carpeta no encontrada en respaldo.'
    });
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
    failed: checks.filter((check) => !check.ok)
  };
}

function compareBackupAgainstCurrent({ backupRoot, storagePaths }) {
  const mapping = [
    { key: 'database', backupFolder: 'database', currentPath: storagePaths.database },
    { key: 'analysis_json', backupFolder: 'analysis_json', currentPath: storagePaths.analysisJson },
    { key: 'templates', backupFolder: 'templates', currentPath: storagePaths.templates },
    { key: 'transcripts', backupFolder: 'transcripts', currentPath: storagePaths.transcripts },
    { key: 'reports_pdf', backupFolder: 'reports_pdf', currentPath: storagePaths.reportsPdf },
    { key: 'reports_txt', backupFolder: 'reports_txt', currentPath: storagePaths.reportsTxt },
    { key: 'logs', backupFolder: 'logs', currentPath: storagePaths.logs },
    { key: 'videos', backupFolder: 'videos', currentPath: storagePaths.videos }
  ];

  const comparison = mapping.map((item) => {
    const backupPath = path.join(backupRoot || '', item.backupFolder);

    return {
      key: item.key,
      backupPath,
      currentPath: item.currentPath,
      backupExists: exists(backupPath),
      currentExists: exists(item.currentPath),
      backupFileCount: countFilesRecursive(backupPath),
      currentFileCount: countFilesRecursive(item.currentPath)
    };
  });

  return {
    ok: true,
    comparison
  };
}

module.exports = {
  REQUIRED_BACKUP_FOLDERS,
  validateBackupStructure,
  compareBackupAgainstCurrent,
  countFilesRecursive
};
