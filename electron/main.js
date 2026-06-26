const { app, BrowserWindow } = require('electron');
const { createMainWindow, registerBaseIpc } = require('./windowManager');

app.setName('Video Auditor App');

function startApp() {
  registerBaseIpc();
  createMainWindow();
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
