const fs = require('fs');
const path = require('path');

const REQUIRED_DIRECTORIES = [
  'data',
  'data/database',
  'data/videos',
  'data/audio',
  'data/frames',
  'data/transcripts',
  'data/reports_pdf',
  'data/reports_txt',
  'data/analysis_json',
  'data/templates',
  'data/logs',
  'data/temp',
  'data/exports',
  'data/exports/backups'
];

const REQUIRED_PROJECT_FILES = [
  'package.json',
  'electron/main.js',
  'electron/preload.js',
  'electron/windowManager.js',
  'src/app/appController.js',
  'src/app/appState.js',
  'src/config/appConfig.js',
  'src/config/storageConfig.js',
  'src/database/schema.sql',
  'src/database/sqliteConnection.js',
  'src/database/migrations.js',
  'src/ui/index.html',
  'src/ui/scripts/renderer.js',
  'src/ui/styles/global.css'
];

const REQUIRED_MODULE_FILES = [
  'src/modules/videoImport/videoImportController.js',
  'src/modules/videoImport/videoImportService.js',
  'src/modules/mediaProcessing/processingController.js',
  'src/modules/library/libraryController.js',
  'src/modules/comparison/comparisonController.js',
  'src/modules/templates/templateController.js',
  'src/modules/backup/backupController.js',
  'src/modules/restore/restoreController.js',
  'src/modules/controlCenter/controlCenterController.js'
];

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function existsFromRoot(relativePath) {
  return fs.existsSync(path.join(getProjectRoot(), relativePath));
}

function checkFiles(files = []) {
  return files.map((relativePath) => ({
    path: relativePath,
    exists: existsFromRoot(relativePath),
    absolutePath: path.join(getProjectRoot(), relativePath)
  }));
}

function checkDirectories(directories = []) {
  return directories.map((relativePath) => {
    const absolutePath = path.join(getProjectRoot(), relativePath);
    const exists = fs.existsSync(absolutePath);
    const isDirectory = exists ? fs.statSync(absolutePath).isDirectory() : false;

    return {
      path: relativePath,
      exists,
      isDirectory,
      absolutePath
    };
  });
}

function summarize(items = []) {
  const total = items.length;
  const ok = items.filter((item) => item.exists && (item.isDirectory === undefined || item.isDirectory)).length;
  const failed = total - ok;

  return {
    total,
    ok,
    failed,
    status: failed === 0 ? 'ok' : 'warning'
  };
}

function buildStartupChecklist() {
  const projectFiles = checkFiles(REQUIRED_PROJECT_FILES);
  const moduleFiles = checkFiles(REQUIRED_MODULE_FILES);
  const directories = checkDirectories(REQUIRED_DIRECTORIES);

  return {
    ok:
      summarize(projectFiles).failed === 0 &&
      summarize(moduleFiles).failed === 0 &&
      summarize(directories).failed === 0,
    generatedAt: new Date().toISOString(),
    projectRoot: getProjectRoot(),
    projectFiles: {
      summary: summarize(projectFiles),
      items: projectFiles
    },
    moduleFiles: {
      summary: summarize(moduleFiles),
      items: moduleFiles
    },
    directories: {
      summary: summarize(directories),
      items: directories
    }
  };
}

module.exports = {
  REQUIRED_DIRECTORIES,
  REQUIRED_PROJECT_FILES,
  REQUIRED_MODULE_FILES,
  buildStartupChecklist,
  checkFiles,
  checkDirectories
};
