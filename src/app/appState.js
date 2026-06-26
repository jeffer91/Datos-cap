const { APP_CONFIG } = require('../config/appConfig');

const appState = {
  initialized: false,
  initializedAt: null,
  lastError: null,

  app: {
    name: APP_CONFIG.appName,
    version: APP_CONFIG.appVersion,
    mode: APP_CONFIG.appMode
  },

  storage: {
    ready: false,
    paths: null
  },

  diagnostics: {
    lastCheckAt: null,
    checks: []
  }
};

function setInitialized(value) {
  appState.initialized = Boolean(value);
  appState.initializedAt = value ? new Date().toISOString() : null;
}

function setStorageReady(paths) {
  appState.storage.ready = true;
  appState.storage.paths = paths;
}

function setLastError(error) {
  appState.lastError = {
    message: error ? error.message : 'Error desconocido',
    stack: error ? error.stack : null,
    timestamp: new Date().toISOString()
  };
}

function clearLastError() {
  appState.lastError = null;
}

function addDiagnosticCheck(check) {
  appState.diagnostics.lastCheckAt = new Date().toISOString();
  appState.diagnostics.checks.push({
    ...check,
    timestamp: new Date().toISOString()
  });

  if (appState.diagnostics.checks.length > 100) {
    appState.diagnostics.checks.shift();
  }
}

function getAppState() {
  return JSON.parse(JSON.stringify(appState));
}

module.exports = {
  setInitialized,
  setStorageReady,
  setLastError,
  clearLastError,
  addDiagnosticCheck,
  getAppState
};
