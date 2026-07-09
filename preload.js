/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /plan-docente-extractor/preload.js
Función o funciones:
- Exponer una API segura desde Electron hacia la interfaz.
- Permitir seleccionar múltiples archivos PDF.
- Permitir validar archivos PDF antes de procesarlos.
- Permitir seleccionar carpeta de salida para Excel y JSON.
- Permitir generar el reporte completo Excel + JSON desde el renderer.
- Evitar que renderer acceda directamente a Node.js.
========================================================= */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = new Set([
  "app:get-info",
  "dialog:select-pdfs",
  "files:validate-pdfs",
  "dialog:choose-output-dir",
  "reports:generate-plan-report"
]);

function invokeSafe(channel, payload) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Canal no permitido: ${channel}`));
  }

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
  },

  generatePlanReport(payload) {
    return invokeSafe("reports:generate-plan-report", payload);
  }
});
