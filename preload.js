/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /plan-docente-extractor/preload.js
Función o funciones:
- Exponer una API segura desde Electron hacia la interfaz.
- Permitir seleccionar múltiples archivos PDF.
- Permitir validar archivos PDF antes de procesarlos.
- Permitir seleccionar carpeta de salida para Excel y JSON.
- Evitar que renderer acceda directamente a Node.js.
========================================================= */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function invokeSafe(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("planDocenteAPI", {
  getAppInfo() {
    return invokeSafe("app:get-info");
  },

  selectPdfFiles() {
    return invokeSafe("dialog:select-pdfs");
  },

  validatePdfFiles(filePaths) {
    return invokeSafe("files:validate-pdfs", filePaths);
  },

  chooseOutputDirectory() {
    return invokeSafe("dialog:choose-output-dir");
  }
});
