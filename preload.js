"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("plansAPI", {
  selectFiles: () => ipcRenderer.invoke("plans:select-files"),
  selectFolder: () => ipcRenderer.invoke("plans:select-folder"),
  process: (filePaths) => ipcRenderer.invoke("plans:process", { filePaths }),
  list: () => ipcRenderer.invoke("plans:list"),
  update: (record) => ipcRenderer.invoke("plans:update", record),
  export: (format) => ipcRenderer.invoke("plans:export", { format }),
  openDataFolder: () => ipcRenderer.invoke("plans:open-data-folder"),
  openFile: (filePath) => ipcRenderer.invoke("plans:open-file", filePath),
  clear: () => ipcRenderer.invoke("plans:clear"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  onProgress: (callback) => subscribe("plans:progress", callback)
});

contextBridge.exposeInMainWorld("agreementsAPI", {
  selectFiles: () => ipcRenderer.invoke("agreements:select-files"),
  selectFolder: () => ipcRenderer.invoke("agreements:select-folder"),
  process: (filePaths) => ipcRenderer.invoke("agreements:process", { filePaths }),
  list: () => ipcRenderer.invoke("agreements:list"),
  update: (record) => ipcRenderer.invoke("agreements:update", record),
  export: (format) => ipcRenderer.invoke("agreements:export", { format }),
  openFile: (filePath) => ipcRenderer.invoke("agreements:open-file", filePath),
  clear: () => ipcRenderer.invoke("agreements:clear"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  onProgress: (callback) => subscribe("plans:progress", callback)
});
