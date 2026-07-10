/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /preload.js
Función o funciones:
- Exponer una API segura desde Electron hacia la interfaz.
- Listar los apartados documentales registrados.
- Seleccionar, validar y procesar PDF según el apartado elegido.
- Mantener compatibilidad temporal con la API anterior.
========================================================= */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = new Set([
  "app:get-info",
  "document-types:list",
  "dialog:select-document-pdfs",
  "files:validate-document-pdfs",
  "dialog:choose-output-dir",
  "reports:generate-document-report",
  "dialog:select-pdfs",
  "files:validate-pdfs",
  "reports:generate-plan-report"
]);

function invokeSafe(channel, payload) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Canal no permitido: ${channel}`));
  }
  return ipcRenderer.invoke(channel, payload);
}

const documentAppAPI = {
  getAppInfo() {
    return invokeSafe("app:get-info");
  },
  listDocumentTypes() {
    return invokeSafe("document-types:list");
  },
  selectPdfFiles(documentType) {
    return invokeSafe("dialog:select-document-pdfs", documentType);
  },
  validatePdfFiles(payload) {
    return invokeSafe("files:validate-document-pdfs", payload);
  },
  chooseOutputDirectory() {
    return invokeSafe("dialog:choose-output-dir");
  },
  generateDocumentReport(payload) {
    return invokeSafe("reports:generate-document-report", payload);
  }
};

contextBridge.exposeInMainWorld("documentAppAPI", documentAppAPI);

contextBridge.exposeInMainWorld("planDocenteAPI", {
  getAppInfo: documentAppAPI.getAppInfo,
  selectPdfFiles() {
    return invokeSafe("dialog:select-pdfs");
  },
  validatePdfFiles(filePaths) {
    return invokeSafe("files:validate-pdfs", filePaths);
  },
  chooseOutputDirectory: documentAppAPI.chooseOutputDirectory,
  generatePlanReport(payload) {
    return invokeSafe("reports:generate-plan-report", payload);
  }
});
