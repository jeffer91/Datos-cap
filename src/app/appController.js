const path = require('path');

const { APP_CONFIG } = require('../config/appConfig');
const { STORAGE_CONFIG } = require('../config/storageConfig');
const { getStoragePaths } = require('../services/pathService');
const {
  ensureDirs,
  writeJson,
  getFileInfo
} = require('../services/fileService');
const {
  initializeLogger,
  logInfo,
  logError,
  readRecentLogInfo
} = require('../services/loggerService');
const {
  setInitialized,
  setStorageReady,
  setLastError,
  clearLastError,
  addDiagnosticCheck,
  getAppState
} = require('./appState');

const { runMigrations, getMigrationStatus } = require('../database/migrations');
const {
  getDatabaseInfo,
  getDatabasePath
} = require('../database/sqliteConnection');

const { countVideos } = require('../database/repositories/videoRepository');
const { countAnalyses } = require('../database/repositories/analysisRepository');
const { countTemplates } = require('../database/repositories/templateRepository');

function getRequiredStoragePaths() {
  const paths = getStoragePaths();

  return [
    paths.dataRoot,
    paths.database,
    paths.videos,
    paths.audio,
    paths.frames,
    paths.transcripts,
    paths.reportsPdf,
    paths.reportsTxt,
    paths.analysisJson,
    paths.templates,
    paths.logs,
    paths.temp,
    paths.exports
  ];
}

function initializeApp() {
  try {
    clearLastError();

    const storagePaths = getStoragePaths();

    if (STORAGE_CONFIG.autoCreateFolders) {
      ensureDirs(getRequiredStoragePaths());
    }

    initializeLogger();

    const migrationResult = runMigrations();

    if (!migrationResult.ok) {
      throw new Error(migrationResult.message);
    }

    const databaseInfo = getDatabaseInfo();

    const diagnosticPath = path.join(
      storagePaths.logs,
      STORAGE_CONFIG.diagnosticFileName
    );

    const diagnostic = {
      app: APP_CONFIG,
      storagePaths,
      database: databaseInfo,
      migration: migrationResult,
      initializedAt: new Date().toISOString()
    };

    writeJson(diagnosticPath, diagnostic);

    setStorageReady(storagePaths);
    setInitialized(true);

    addDiagnosticCheck({
      name: 'initializeApp',
      ok: true,
      message: 'Aplicación inicializada correctamente con SQLite.'
    });

    logInfo('Aplicación inicializada correctamente con SQLite', {
      storagePaths,
      databaseInfo,
      diagnosticPath
    });

    return {
      ok: true,
      message: 'Aplicación inicializada correctamente con SQLite.',
      app: APP_CONFIG,
      storagePaths,
      database: databaseInfo,
      migration: migrationResult,
      diagnosticPath,
      state: getAppState()
    };
  } catch (error) {
    setLastError(error);

    addDiagnosticCheck({
      name: 'initializeApp',
      ok: false,
      message: error.message
    });

    try {
      logError('Error al inicializar la aplicación', error);
    } catch (_) {
      // Si el logger falla, no detenemos la app.
    }

    return {
      ok: false,
      message: 'No se pudo inicializar la aplicación.',
      error: {
        message: error.message,
        stack: error.stack
      },
      state: getAppState()
    };
  }
}

function getAppStatus() {
  const state = getAppState();

  return {
    ok: true,
    app: APP_CONFIG,
    state,
    database: {
      path: getDatabasePath(),
      info: getDatabaseInfo(),
      migrations: getMigrationStatus(),
      counts: {
        videos: countVideos(),
        analyses: countAnalyses(),
        templates: countTemplates()
      }
    },
    logs: readRecentLogInfo(),
    timestamp: new Date().toISOString()
  };
}

function runBaseDiagnostic() {
  const storagePaths = getStoragePaths();

  const storageChecks = Object.entries(storagePaths).map(([key, value]) => {
    const info = getFileInfo(value);

    return {
      key,
      path: value,
      exists: info.exists,
      isDirectory: info.isDirectory || false
    };
  });

  const failedStorage = storageChecks.filter((check) => !check.exists);

  let databaseDiagnostic = null;

  try {
    databaseDiagnostic = {
      ok: true,
      info: getDatabaseInfo(),
      migrations: getMigrationStatus(),
      counts: {
        videos: countVideos(),
        analyses: countAnalyses(),
        templates: countTemplates()
      }
    };
  } catch (error) {
    databaseDiagnostic = {
      ok: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }

  const result = {
    ok: failedStorage.length === 0 && databaseDiagnostic.ok,
    message:
      failedStorage.length === 0 && databaseDiagnostic.ok
        ? 'Diagnóstico correcto. Carpetas y SQLite están listos.'
        : 'Diagnóstico con observaciones.',
    storageChecks,
    failedStorage,
    database: databaseDiagnostic,
    timestamp: new Date().toISOString()
  };

  addDiagnosticCheck({
    name: 'runBaseDiagnostic',
    ok: result.ok,
    message: result.message
  });

  return result;
}

function getBaseConfiguration() {
  return {
    ok: true,
    appConfig: APP_CONFIG,
    storageConfig: STORAGE_CONFIG,
    storagePaths: getStoragePaths(),
    databasePath: getDatabasePath()
  };
}

module.exports = {
  initializeApp,
  getAppStatus,
  runBaseDiagnostic,
  getBaseConfiguration
};
