"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { PlanStorage } = require("./src/storage");
const { registerAgreementIpc } = require("./src/agreement-ipc");

require("./main");

function currentWindow() {
  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) || null;
}

function emitProgress(payload) {
  const window = currentWindow();
  if (!window) return;
  window.webContents.send("plans:progress", payload);
}

app.whenReady().then(() => {
  const dataPath = path.join(app.getPath("userData"), "data");
  const planStorage = new PlanStorage(dataPath);
  registerAgreementIpc({
    ipcMain,
    dialog,
    shell,
    getMainWindow: currentWindow,
    dataPath,
    planStorage,
    maxFiles: 500,
    emitProgress
  });
});
