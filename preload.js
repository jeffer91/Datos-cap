"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("plansAPI", {
  selectFiles: () => ipcRenderer.invoke("plans:select-files"),
  selectFolder: () => ipcRenderer.invoke("plans:select-folder"),
  process: (filePaths) => ipcRenderer.invoke("plans:process", { filePaths }),
  list: () => ipcRenderer.invoke("plans:list"),
  export: (format) => ipcRenderer.invoke("plans:export", { format }),
  openDataFolder: () => ipcRenderer.invoke("plans:open-data-folder"),
  openFile: (filePath) => ipcRenderer.invoke("plans:open-file", filePath),
  clear: () => ipcRenderer.invoke("plans:clear"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  onProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("plans:progress", listener);
    return () => ipcRenderer.removeListener("plans:progress", listener);
  }
});
