const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');

const {
  initializeApp,
  getAppStatus,
  runBaseDiagnostic,
  getBaseConfiguration
} = require('../src/app/appController');

const { APP_CONFIG } = require('../src/config/appConfig');

const {
  handleGetVideoImportOptions,
  handleImportVideo,
  handleListRecentImportedVideos,
  handleGetImportedVideo
} = require('../src/modules/videoImport/videoImportController');

const {
  handleProcessImportedVideo,
  handleGetMediaProcessingDiagnostic
} = require('../src/modules/mediaProcessing/processingController');

const {
  handleGetLibrarySummary,
  handleListLibraryAnalyses,
  handleListLibraryVideos,
  handleGetAnalysisDetails,
  handleGetRecentLibraryActivity
} = require('../src/modules/library/libraryController');

const {
  handleListComparableAnalyses,
  handleCompareAnalyses,
  handleComparisonDiagnostic
} = require('../src/modules/comparison/comparisonController');

let mainWindow = null;
let ipcRegistered = false;

function registerBaseIpc() {
  if (ipcRegistered) return;

  ipcMain.handle('app:ping', async () => ({
    ok: true,
    appName: 'Video Auditor App',
    mode: 'electron-local',
    platform: process.platform,
    timestamp: new Date().toISOString()
  }));

  ipcMain.handle('app:initialize', async () => initializeApp());
  ipcMain.handle('app:getStatus', async () => getAppStatus());
  ipcMain.handle('app:diagnostic', async () => runBaseDiagnostic());
  ipcMain.handle('app:getConfig', async () => getBaseConfiguration());

  ipcMain.handle('dialog:selectVideo', async () => {
    const extensions = APP_CONFIG.supportedVideoExtensions.map((extension) => extension.replace('.', ''));
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar video para auditar',
      properties: ['openFile'],
      filters: [{ name: 'Videos permitidos', extensions }]
    });

    if (result.canceled || !result.filePaths.length) {
      return { ok: true, canceled: true };
    }

    const filePath = result.filePaths[0];
    return { ok: true, canceled: false, filePath, fileName: path.basename(filePath) };
  });

  ipcMain.handle('fileSystem:openPath', async (_event, targetPath) => {
    if (!targetPath) return { ok: false, message: 'No se recibió una ruta para abrir.' };
    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) return { ok: false, message: 'No se pudo abrir el archivo.', error: errorMessage, path: targetPath };
    return { ok: true, message: 'Archivo abierto correctamente.', path: targetPath };
  });

  ipcMain.handle('videoImport:getOptions', async () => handleGetVideoImportOptions());
  ipcMain.handle('videoImport:importVideo', async (_event, payload) => handleImportVideo(payload));
  ipcMain.handle('videoImport:listRecentVideos', async (_event, limit) => handleListRecentImportedVideos(limit));
  ipcMain.handle('videoImport:getVideo', async (_event, localId) => handleGetImportedVideo(localId));

  ipcMain.handle('mediaProcessing:processVideo', async (_event, payload) => handleProcessImportedVideo(payload));
  ipcMain.handle('mediaProcessing:diagnostic', async () => handleGetMediaProcessingDiagnostic());

  ipcMain.handle('library:getSummary', async () => handleGetLibrarySummary());
  ipcMain.handle('library:listAnalyses', async (_event, payload) => handleListLibraryAnalyses(payload));
  ipcMain.handle('library:listVideos', async (_event, payload) => handleListLibraryVideos(payload));
  ipcMain.handle('library:getAnalysisDetails', async (_event, analysisLocalId) => handleGetAnalysisDetails(analysisLocalId));
  ipcMain.handle('library:getRecentActivity', async (_event, limit) => handleGetRecentLibraryActivity(limit));

  ipcMain.handle('comparison:listAnalyses', async (_event, limit) => handleListComparableAnalyses(limit));
  ipcMain.handle('comparison:compare', async (_event, payload) => handleCompareAnalyses(payload));
  ipcMain.handle('comparison:diagnostic', async () => handleComparisonDiagnostic());

  ipcRegistered = true;
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    title: 'Video Auditor App',
    backgroundColor: '#f4f7fb',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

module.exports = { createMainWindow, registerBaseIpc };
